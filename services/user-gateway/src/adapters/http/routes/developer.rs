use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, post},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    adapters::http::{app_state::AppState, extractors::CurrentUser},
    app_error::{AppError, AppResult},
    use_cases::{
        developer_auth::{
            DeveloperAccount, DeveloperApiKey, DeveloperApiKeyScope, IssuedApiKey, ScopeMatchType,
            ScopeResourceType,
        },
        user::UserProfile,
    },
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/me", get(me))
        .route("/keys", get(list_keys).post(create_key))
        .route("/keys/{id}/revoke", post(revoke_key))
        .route("/keys/{id}/rotate", post(rotate_key))
        .route("/keys/{id}/scopes", get(list_scopes).post(create_scope))
        .route("/scopes/{id}", delete(delete_scope))
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

async fn me(
    CurrentUser(user): CurrentUser,
    State(state): State<AppState>,
) -> AppResult<Json<DeveloperAccount>> {
    Ok(Json(owned_account(&state, &user).await?))
}

async fn list_keys(
    CurrentUser(user): CurrentUser,
    State(state): State<AppState>,
) -> AppResult<Json<Vec<DeveloperApiKey>>> {
    let account = owned_account(&state, &user).await?;
    Ok(Json(
        state.developer_auth_repo.list_api_keys(account.id).await?,
    ))
}

async fn create_key(
    CurrentUser(user): CurrentUser,
    State(state): State<AppState>,
    Json(request): Json<CreateKeyRequest>,
) -> AppResult<(StatusCode, Json<IssuedKeyResponse>)> {
    let account = mutable_owned_account(&state, &user).await?;
    let issued = state
        .developer_auth_use_cases
        .issue_api_key(account.id, &request.name, request.expires_at)
        .await?;
    Ok((StatusCode::CREATED, Json(issued.into())))
}

async fn revoke_key(
    CurrentUser(user): CurrentUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let account = mutable_owned_account(&state, &user).await?;
    let _ = owned_api_key(&state, &account, id).await?;
    state.developer_auth_repo.revoke_api_key(id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn rotate_key(
    CurrentUser(user): CurrentUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<(StatusCode, Json<IssuedKeyResponse>)> {
    let account = mutable_owned_account(&state, &user).await?;
    let _ = owned_api_key(&state, &account, id).await?;
    let issued = state.developer_auth_use_cases.rotate_api_key(id).await?;
    Ok((StatusCode::CREATED, Json(issued.into())))
}

async fn list_scopes(
    CurrentUser(user): CurrentUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Vec<DeveloperApiKeyScope>>> {
    let account = owned_account(&state, &user).await?;
    let _ = owned_api_key(&state, &account, id).await?;
    Ok(Json(state.developer_auth_repo.list_scopes(id).await?))
}

async fn create_scope(
    CurrentUser(user): CurrentUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(request): Json<CreateScopeRequest>,
) -> AppResult<(StatusCode, Json<DeveloperApiKeyScope>)> {
    let account = mutable_owned_account(&state, &user).await?;
    let _ = owned_api_key(&state, &account, id).await?;
    validate_scope_request(&request)?;
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
    Ok((StatusCode::CREATED, Json(scope)))
}

async fn delete_scope(
    CurrentUser(user): CurrentUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let account = mutable_owned_account(&state, &user).await?;
    let scope = state
        .developer_auth_repo
        .get_scope(id)
        .await?
        .ok_or(AppError::NotFound)?;
    let _ = owned_api_key(&state, &account, scope.api_key_id).await?;
    state.developer_auth_repo.delete_scope(id).await?;
    Ok(StatusCode::NO_CONTENT)
}

impl From<IssuedApiKey> for IssuedKeyResponse {
    fn from(value: IssuedApiKey) -> Self {
        Self {
            api_key: value.api_key,
            raw_key: value.raw_key,
        }
    }
}

async fn owned_account(state: &AppState, user: &UserProfile) -> AppResult<DeveloperAccount> {
    state
        .developer_auth_use_cases
        .ensure_owned_developer_account(user.id, &user.email)
        .await
}

async fn mutable_owned_account(
    state: &AppState,
    user: &UserProfile,
) -> AppResult<DeveloperAccount> {
    let account = owned_account(state, user).await?;
    if account.is_frozen {
        return Err(AppError::Conflict("developer account is frozen".into()));
    }
    Ok(account)
}

async fn owned_api_key(
    state: &AppState,
    account: &DeveloperAccount,
    api_key_id: Uuid,
) -> AppResult<DeveloperApiKey> {
    let key = state
        .developer_auth_repo
        .get_api_key(api_key_id)
        .await?
        .ok_or(AppError::NotFound)?;
    if key.developer_account_id != account.id {
        return Err(AppError::NotFound);
    }
    Ok(key)
}

fn validate_scope_request(request: &CreateScopeRequest) -> AppResult<()> {
    if !request.can_read && !request.can_write {
        return Err(AppError::InvalidInput(
            "scope must grant read or write".into(),
        ));
    }
    if request.match_type != ScopeMatchType::All
        && request
            .bucket
            .as_deref()
            .is_none_or(|bucket| bucket.trim().is_empty())
    {
        return Err(AppError::InvalidInput(
            "bucket is required for exact or prefix scopes".into(),
        ));
    }
    Ok(())
}
