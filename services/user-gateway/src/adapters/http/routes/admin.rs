use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{delete, get, post},
};
use axum_extra::extract::cookie::{Cookie, SameSite};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::{
    adapters::http::{app_state::AppState, extractors::AdminUser},
    app_error::{AppError, AppResult},
    application::jwt,
    use_cases::{
        audit::NewAuditEntry,
        user::{UserProfile, UserStats},
    },
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/me", get(me))
        .route("/stats", get(stats))
        .route("/users", get(list_users))
        .route("/users/{id}", get(get_user))
        .route("/users/{id}", delete(delete_user))
        .route("/users/{id}/freeze", post(freeze_user))
        .route("/users/{id}/unfreeze", post(unfreeze_user))
        .route("/users/{id}/impersonate", post(impersonate_user))
        .route("/audit", get(list_audit))
}

// ---------- DTOs ----------

#[derive(Serialize)]
struct UserDto {
    id: Uuid,
    email: String,
    language: String,
    created_at: chrono::DateTime<chrono::Utc>,
    updated_at: chrono::DateTime<chrono::Utc>,
    last_login_at: Option<chrono::DateTime<chrono::Utc>>,
    is_admin: bool,
    is_frozen: bool,
}

impl From<UserProfile> for UserDto {
    fn from(p: UserProfile) -> Self {
        UserDto {
            id: p.id,
            email: p.email,
            language: p.language,
            created_at: p.created_at,
            updated_at: p.updated_at,
            last_login_at: p.last_login_at,
            is_admin: p.is_admin,
            is_frozen: p.is_frozen,
        }
    }
}

#[derive(Serialize)]
struct StatsDto {
    total_users: i64,
    users_last_7_days: i64,
    users_last_30_days: i64,
    frozen_users: i64,
    admin_users: i64,
}

impl From<UserStats> for StatsDto {
    fn from(s: UserStats) -> Self {
        StatsDto {
            total_users: s.total_users,
            users_last_7_days: s.users_last_7_days,
            users_last_30_days: s.users_last_30_days,
            frozen_users: s.frozen_users,
            admin_users: s.admin_users,
        }
    }
}

#[derive(Deserialize)]
struct ListUsersQuery {
    q: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Serialize)]
struct ListUsersDto {
    users: Vec<UserDto>,
    total: i64,
    limit: i64,
    offset: i64,
}

#[derive(Deserialize)]
struct AuditQuery {
    limit: Option<i64>,
    offset: Option<i64>,
}

// ---------- Handlers ----------

async fn me(AdminUser(admin): AdminUser) -> AppResult<Json<UserDto>> {
    Ok(Json(admin.into()))
}

async fn stats(
    AdminUser(_): AdminUser,
    State(state): State<AppState>,
) -> AppResult<Json<StatsDto>> {
    let stats = state.user_repo.stats().await?;
    Ok(Json(stats.into()))
}

async fn list_users(
    AdminUser(_): AdminUser,
    State(state): State<AppState>,
    Query(q): Query<ListUsersQuery>,
) -> AppResult<Json<ListUsersDto>> {
    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let offset = q.offset.unwrap_or(0).max(0);
    let query = q.q.as_deref().filter(|s| !s.is_empty());
    let users = state.user_repo.list_users(query, limit, offset).await?;
    let total = state.user_repo.count_users(query).await?;
    Ok(Json(ListUsersDto {
        users: users.into_iter().map(Into::into).collect(),
        total,
        limit,
        offset,
    }))
}

async fn get_user(
    AdminUser(_): AdminUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<UserDto>> {
    let user = state
        .user_repo
        .get_profile_by_id(id)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(user.into()))
}

async fn freeze_user(
    AdminUser(admin): AdminUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<UserDto>> {
    let target = state
        .user_repo
        .get_profile_by_id(id)
        .await?
        .ok_or(AppError::NotFound)?;
    if target.id == admin.id {
        return Err(AppError::Conflict("cannot freeze yourself".into()));
    }
    if target.is_admin {
        return Err(AppError::Conflict("cannot freeze another admin".into()));
    }
    state.user_repo.set_frozen(id, true).await?;
    write_audit(&state, &admin, "user.freeze", Some(&target), json!({})).await?;
    let updated = state
        .user_repo
        .get_profile_by_id(id)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(updated.into()))
}

async fn unfreeze_user(
    AdminUser(admin): AdminUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<UserDto>> {
    let target = state
        .user_repo
        .get_profile_by_id(id)
        .await?
        .ok_or(AppError::NotFound)?;
    state.user_repo.set_frozen(id, false).await?;
    write_audit(&state, &admin, "user.unfreeze", Some(&target), json!({})).await?;
    let updated = state
        .user_repo
        .get_profile_by_id(id)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(updated.into()))
}

async fn delete_user(
    AdminUser(admin): AdminUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let target = state
        .user_repo
        .get_profile_by_id(id)
        .await?
        .ok_or(AppError::NotFound)?;
    if target.id == admin.id {
        return Err(AppError::Conflict("cannot delete yourself".into()));
    }
    if target.is_admin {
        return Err(AppError::Conflict("cannot delete another admin".into()));
    }
    // Log BEFORE delete so admin_audit_log.target_user_id still resolves;
    // the ON DELETE SET NULL keeps the trail readable either way.
    write_audit(&state, &admin, "user.delete", Some(&target), json!({})).await?;
    state.user_repo.delete_user(id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn impersonate_user(
    AdminUser(admin): AdminUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let target = state
        .user_repo
        .get_profile_by_id(id)
        .await?
        .ok_or(AppError::NotFound)?;
    if target.is_admin {
        return Err(AppError::Conflict(
            "cannot impersonate another admin".into(),
        ));
    }
    if target.is_frozen {
        return Err(AppError::Conflict(
            "cannot impersonate a frozen user".into(),
        ));
    }

    let ttl = time::Duration::minutes(state.config.impersonation_ttl_minutes);
    let access = jwt::issue(target.id, &state.config.jwt_secret, ttl)?;

    write_audit(
        &state,
        &admin,
        "user.impersonate",
        Some(&target),
        json!({ "ttl_minutes": state.config.impersonation_ttl_minutes }),
    )
    .await?;

    // Replace the admin's session cookies with impersonation cookies.
    // Admin must log out + log back in to end impersonation.
    // A visible `impersonating` cookie (non-httponly) lets the UI render a banner.
    let mut headers = HeaderMap::new();
    let access_cookie = Cookie::build(("access_token", access))
        .http_only(true)
        .same_site(SameSite::Lax)
        .path("/")
        .max_age(ttl)
        .build();
    // Clear refresh so impersonation cannot be extended silently.
    let refresh_cookie = Cookie::build(("refresh_token", ""))
        .http_only(true)
        .same_site(SameSite::Lax)
        .path("/")
        .max_age(time::Duration::seconds(0))
        .build();
    let email_cookie = Cookie::build(("user_email", target.email.clone()))
        .http_only(false)
        .same_site(SameSite::Lax)
        .path("/")
        .max_age(ttl)
        .build();
    let banner_cookie = Cookie::build(("impersonating", target.email.clone()))
        .http_only(false)
        .same_site(SameSite::Lax)
        .path("/")
        .max_age(ttl)
        .build();
    for c in [access_cookie, refresh_cookie, email_cookie, banner_cookie] {
        headers.append("set-cookie", c.to_string().parse().unwrap());
    }

    Ok((StatusCode::OK, headers, Json(json!({ "ok": true }))))
}

#[derive(Serialize)]
struct AuditListDto {
    entries: Vec<crate::use_cases::audit::AuditEntry>,
    total: i64,
    limit: i64,
    offset: i64,
}

async fn list_audit(
    AdminUser(_): AdminUser,
    State(state): State<AppState>,
    Query(q): Query<AuditQuery>,
) -> AppResult<Json<AuditListDto>> {
    let limit = q.limit.unwrap_or(100).clamp(1, 500);
    let offset = q.offset.unwrap_or(0).max(0);
    let entries = state.audit_repo.list(limit, offset).await?;
    let total = state.audit_repo.count().await?;
    Ok(Json(AuditListDto {
        entries,
        total,
        limit,
        offset,
    }))
}

// ---------- helpers ----------

async fn write_audit(
    state: &AppState,
    admin: &UserProfile,
    action: &str,
    target: Option<&UserProfile>,
    metadata: serde_json::Value,
) -> AppResult<()> {
    state
        .audit_repo
        .log(NewAuditEntry {
            admin_id: admin.id,
            admin_email: admin.email.clone(),
            action: action.to_string(),
            target_user_id: target.map(|t| t.id),
            target_email: target.map(|t| t.email.clone()),
            metadata,
        })
        .await
}
