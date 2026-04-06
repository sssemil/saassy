use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, post},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::{
    adapters::http::{app_state::AppState, extractors::AdminUser},
    app_error::{AppError, AppResult},
    use_cases::developer_auth::{
        DeveloperAccount, DeveloperApiKey, DeveloperApiKeyScope, DeveloperAuthAuditEntry,
        DeveloperAuthRepo, NewDeveloperAuthAuditEntry, ScopeMatchType, ScopeResourceType,
    },
    use_cases::user::UserProfile,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/developers", get(list_developers).post(create_developer))
        .route("/developers/{id}", get(get_developer))
        .route("/developers/{id}/freeze", post(freeze_developer))
        .route("/developers/{id}/unfreeze", post(unfreeze_developer))
        .route("/developers/{id}/keys", get(list_keys).post(create_key))
        .route("/keys/{id}/revoke", post(revoke_key))
        .route("/keys/{id}/rotate", post(rotate_key))
        .route("/keys/{id}/scopes", get(list_scopes).post(create_scope))
        .route("/scopes/{id}", delete(delete_scope))
        .route("/developer-auth/audit", get(list_audit))
}

#[derive(Deserialize)]
struct ListQuery {
    q: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Serialize)]
struct ListDevelopersResponse {
    developers: Vec<DeveloperAccount>,
    total: i64,
    limit: i64,
    offset: i64,
}

#[derive(Deserialize)]
struct CreateDeveloperRequest {
    name: String,
}

#[derive(Deserialize)]
struct CreateKeyRequest {
    name: String,
    expires_at: Option<DateTime<Utc>>,
}

#[derive(Serialize)]
struct IssuedKeyResponse {
    api_key: DeveloperApiKey,
    raw_key: String,
}

#[derive(Deserialize)]
struct CreateScopeRequest {
    match_type: ScopeMatchType,
    bucket: Option<String>,
    #[serde(default)]
    can_read: bool,
    #[serde(default)]
    can_write: bool,
}

#[derive(Serialize)]
struct ListAuditResponse {
    entries: Vec<DeveloperAuthAuditEntry>,
    total: i64,
    limit: i64,
    offset: i64,
}

async fn list_developers(
    AdminUser(_): AdminUser,
    State(state): State<AppState>,
    Query(query): Query<ListQuery>,
) -> AppResult<Json<ListDevelopersResponse>> {
    let limit = query.limit.unwrap_or(50).clamp(1, 200);
    let offset = query.offset.unwrap_or(0).max(0);
    let q = query.q.as_deref().filter(|value| !value.is_empty());
    let developers = state
        .developer_auth_repo
        .list_developer_accounts(q, limit, offset)
        .await?;
    let total = state.developer_auth_repo.count_developer_accounts(q).await?;
    Ok(Json(ListDevelopersResponse {
        developers,
        total,
        limit,
        offset,
    }))
}

async fn create_developer(
    AdminUser(admin): AdminUser,
    State(state): State<AppState>,
    Json(request): Json<CreateDeveloperRequest>,
) -> AppResult<(StatusCode, Json<DeveloperAccount>)> {
    let developer = state
        .developer_auth_use_cases
        .create_developer_account(&request.name)
        .await?;
    write_audit(
        &state.developer_auth_repo,
        &admin,
        "developer_account.create",
        Some(developer.id),
        None,
        json!({
            "public_id": developer.public_id,
            "name": developer.name,
        }),
    )
    .await?;
    Ok((StatusCode::CREATED, Json(developer)))
}

async fn get_developer(
    AdminUser(_): AdminUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<DeveloperAccount>> {
    let developer = state
        .developer_auth_repo
        .get_developer_account(id)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(developer))
}

async fn freeze_developer(
    AdminUser(admin): AdminUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<DeveloperAccount>> {
    let developer = state
        .developer_auth_repo
        .get_developer_account(id)
        .await?
        .ok_or(AppError::NotFound)?;
    state
        .developer_auth_repo
        .set_developer_account_frozen(id, true)
        .await?;
    write_audit(
        &state.developer_auth_repo,
        &admin,
        "developer_account.freeze",
        Some(id),
        None,
        json!({ "public_id": developer.public_id }),
    )
    .await?;
    let updated = state
        .developer_auth_repo
        .get_developer_account(id)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(updated))
}

async fn unfreeze_developer(
    AdminUser(admin): AdminUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<DeveloperAccount>> {
    let developer = state
        .developer_auth_repo
        .get_developer_account(id)
        .await?
        .ok_or(AppError::NotFound)?;
    state
        .developer_auth_repo
        .set_developer_account_frozen(id, false)
        .await?;
    write_audit(
        &state.developer_auth_repo,
        &admin,
        "developer_account.unfreeze",
        Some(id),
        None,
        json!({ "public_id": developer.public_id }),
    )
    .await?;
    let updated = state
        .developer_auth_repo
        .get_developer_account(id)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(updated))
}

async fn list_keys(
    AdminUser(_): AdminUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Vec<DeveloperApiKey>>> {
    ensure_developer_exists(&state.developer_auth_repo, id).await?;
    Ok(Json(state.developer_auth_repo.list_api_keys(id).await?))
}

async fn create_key(
    AdminUser(admin): AdminUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(request): Json<CreateKeyRequest>,
) -> AppResult<(StatusCode, Json<IssuedKeyResponse>)> {
    let developer = ensure_developer_exists(&state.developer_auth_repo, id).await?;
    let issued = state
        .developer_auth_use_cases
        .issue_api_key(id, &request.name, request.expires_at)
        .await?;
    write_audit(
        &state.developer_auth_repo,
        &admin,
        "developer_api_key.create",
        Some(id),
        Some(issued.api_key.id),
        json!({
            "developer_public_id": developer.public_id,
            "key_name": issued.api_key.name,
            "key_prefix": issued.api_key.key_prefix,
        }),
    )
    .await?;
    Ok((
        StatusCode::CREATED,
        Json(IssuedKeyResponse {
            api_key: issued.api_key,
            raw_key: issued.raw_key,
        }),
    ))
}

async fn revoke_key(
    AdminUser(admin): AdminUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let key = state
        .developer_auth_repo
        .get_api_key(id)
        .await?
        .ok_or(AppError::NotFound)?;
    state.developer_auth_repo.revoke_api_key(id).await?;
    write_audit(
        &state.developer_auth_repo,
        &admin,
        "developer_api_key.revoke",
        Some(key.developer_account_id),
        Some(id),
        json!({
            "key_name": key.name,
            "key_prefix": key.key_prefix,
        }),
    )
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn rotate_key(
    AdminUser(admin): AdminUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<(StatusCode, Json<IssuedKeyResponse>)> {
    let current = state
        .developer_auth_repo
        .get_api_key(id)
        .await?
        .ok_or(AppError::NotFound)?;
    let issued = state.developer_auth_use_cases.rotate_api_key(id).await?;
    write_audit(
        &state.developer_auth_repo,
        &admin,
        "developer_api_key.rotate",
        Some(current.developer_account_id),
        Some(issued.api_key.id),
        json!({
            "rotated_from_api_key_id": id,
            "key_name": issued.api_key.name,
            "key_prefix": issued.api_key.key_prefix,
        }),
    )
    .await?;
    Ok((
        StatusCode::CREATED,
        Json(IssuedKeyResponse {
            api_key: issued.api_key,
            raw_key: issued.raw_key,
        }),
    ))
}

async fn list_scopes(
    AdminUser(_): AdminUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Vec<DeveloperApiKeyScope>>> {
    let _ = state
        .developer_auth_repo
        .get_api_key(id)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(state.developer_auth_repo.list_scopes(id).await?))
}

async fn create_scope(
    AdminUser(admin): AdminUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(request): Json<CreateScopeRequest>,
) -> AppResult<(StatusCode, Json<DeveloperApiKeyScope>)> {
    let key = state
        .developer_auth_repo
        .get_api_key(id)
        .await?
        .ok_or(AppError::NotFound)?;
    if !request.can_read && !request.can_write {
        return Err(AppError::InvalidInput(
            "scope must grant read or write".into(),
        ));
    }
    if request.match_type != ScopeMatchType::All
        && request.bucket.as_deref().is_none_or(|bucket| bucket.trim().is_empty())
    {
        return Err(AppError::InvalidInput(
            "bucket is required for exact or prefix scopes".into(),
        ));
    }
    let scope = state
        .developer_auth_repo
        .create_scope(
            id,
            ScopeResourceType::Bucket,
            request.match_type,
            request.bucket.as_deref(),
            request.can_read,
            request.can_write,
        )
        .await?;
    write_audit(
        &state.developer_auth_repo,
        &admin,
        "developer_api_key_scope.create",
        Some(key.developer_account_id),
        Some(id),
        json!({
            "scope_id": scope.id,
            "match_type": scope.match_type,
            "bucket": scope.resource_value,
            "can_read": scope.can_read,
            "can_write": scope.can_write,
        }),
    )
    .await?;
    Ok((StatusCode::CREATED, Json(scope)))
}

async fn delete_scope(
    AdminUser(admin): AdminUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let scope = state
        .developer_auth_repo
        .get_scope(id)
        .await?
        .ok_or(AppError::NotFound)?;
    let key = state
        .developer_auth_repo
        .get_api_key(scope.api_key_id)
        .await?
        .ok_or(AppError::NotFound)?;
    state.developer_auth_repo.delete_scope(id).await?;
    write_audit(
        &state.developer_auth_repo,
        &admin,
        "developer_api_key_scope.delete",
        Some(key.developer_account_id),
        Some(scope.api_key_id),
        json!({
            "scope_id": id,
            "match_type": scope.match_type,
            "bucket": scope.resource_value,
        }),
    )
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn list_audit(
    AdminUser(_): AdminUser,
    State(state): State<AppState>,
    Query(query): Query<ListQuery>,
) -> AppResult<Json<ListAuditResponse>> {
    let limit = query.limit.unwrap_or(50).clamp(1, 200);
    let offset = query.offset.unwrap_or(0).max(0);
    let entries = state
        .developer_auth_repo
        .list_developer_auth_audit(limit, offset)
        .await?;
    let total = state.developer_auth_repo.count_developer_auth_audit().await?;
    Ok(Json(ListAuditResponse {
        entries,
        total,
        limit,
        offset,
    }))
}

async fn ensure_developer_exists(
    repo: &Arc<dyn DeveloperAuthRepo>,
    developer_id: Uuid,
) -> AppResult<DeveloperAccount> {
    repo.get_developer_account(developer_id)
        .await?
        .ok_or(AppError::NotFound)
}

async fn write_audit(
    repo: &Arc<dyn DeveloperAuthRepo>,
    admin: &UserProfile,
    action: &str,
    developer_account_id: Option<Uuid>,
    api_key_id: Option<Uuid>,
    metadata: serde_json::Value,
) -> AppResult<()> {
    repo.log_developer_auth_audit(NewDeveloperAuthAuditEntry {
        admin_id: admin.id,
        admin_email: admin.email.clone(),
        action: action.to_string(),
        developer_account_id,
        api_key_id,
        metadata,
    })
    .await
}
