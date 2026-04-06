use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde_json::Value as JsonValue;
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    adapters::persistence::PostgresPersistence,
    app_error::{AppError, AppResult},
    use_cases::developer_auth::{
        ApiKeyWithOwner, DeveloperAccount, DeveloperApiKey, DeveloperApiKeyScope,
        DeveloperAuthAuditEntry, DeveloperAuthRepo, NewDeveloperAuthAuditEntry, ScopeMatchType,
        ScopeResourceType,
    },
};

#[derive(Debug, FromRow)]
struct DeveloperAccountRow {
    id: Uuid,
    public_id: String,
    name: String,
    is_frozen: bool,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<DeveloperAccountRow> for DeveloperAccount {
    fn from(value: DeveloperAccountRow) -> Self {
        Self {
            id: value.id,
            public_id: value.public_id,
            name: value.name,
            is_frozen: value.is_frozen,
            created_at: value.created_at,
            updated_at: value.updated_at,
        }
    }
}

#[derive(Debug, FromRow)]
struct DeveloperApiKeyRow {
    id: Uuid,
    developer_account_id: Uuid,
    name: String,
    key_prefix: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    last_used_at: Option<DateTime<Utc>>,
    revoked_at: Option<DateTime<Utc>>,
    expires_at: Option<DateTime<Utc>>,
}

impl From<DeveloperApiKeyRow> for DeveloperApiKey {
    fn from(value: DeveloperApiKeyRow) -> Self {
        Self {
            id: value.id,
            developer_account_id: value.developer_account_id,
            name: value.name,
            key_prefix: value.key_prefix,
            created_at: value.created_at,
            updated_at: value.updated_at,
            last_used_at: value.last_used_at,
            revoked_at: value.revoked_at,
            expires_at: value.expires_at,
        }
    }
}

#[derive(Debug, FromRow)]
struct DeveloperApiKeyScopeRow {
    id: Uuid,
    api_key_id: Uuid,
    resource_type: String,
    match_type: String,
    resource_value: Option<String>,
    can_read: bool,
    can_write: bool,
    created_at: DateTime<Utc>,
}

impl TryFrom<DeveloperApiKeyScopeRow> for DeveloperApiKeyScope {
    type Error = AppError;

    fn try_from(value: DeveloperApiKeyScopeRow) -> Result<Self, Self::Error> {
        Ok(Self {
            id: value.id,
            api_key_id: value.api_key_id,
            resource_type: parse_resource_type(&value.resource_type)?,
            match_type: parse_match_type(&value.match_type)?,
            resource_value: value.resource_value,
            can_read: value.can_read,
            can_write: value.can_write,
            created_at: value.created_at,
        })
    }
}

#[derive(Debug, FromRow)]
struct ApiKeyLookupRow {
    api_key_id: Uuid,
    developer_account_id: Uuid,
    api_key_name: String,
    key_prefix: String,
    api_key_created_at: DateTime<Utc>,
    api_key_updated_at: DateTime<Utc>,
    api_key_last_used_at: Option<DateTime<Utc>>,
    api_key_revoked_at: Option<DateTime<Utc>>,
    api_key_expires_at: Option<DateTime<Utc>>,
    account_public_id: String,
    account_name: String,
    account_is_frozen: bool,
    account_created_at: DateTime<Utc>,
    account_updated_at: DateTime<Utc>,
}

impl From<ApiKeyLookupRow> for ApiKeyWithOwner {
    fn from(value: ApiKeyLookupRow) -> Self {
        Self {
            api_key: DeveloperApiKey {
                id: value.api_key_id,
                developer_account_id: value.developer_account_id,
                name: value.api_key_name,
                key_prefix: value.key_prefix,
                created_at: value.api_key_created_at,
                updated_at: value.api_key_updated_at,
                last_used_at: value.api_key_last_used_at,
                revoked_at: value.api_key_revoked_at,
                expires_at: value.api_key_expires_at,
            },
            account: DeveloperAccount {
                id: value.developer_account_id,
                public_id: value.account_public_id,
                name: value.account_name,
                is_frozen: value.account_is_frozen,
                created_at: value.account_created_at,
                updated_at: value.account_updated_at,
            },
        }
    }
}

#[derive(Debug, FromRow)]
struct DeveloperAuthAuditRow {
    id: Uuid,
    admin_id: Option<Uuid>,
    admin_email: String,
    action: String,
    developer_account_id: Option<Uuid>,
    api_key_id: Option<Uuid>,
    metadata: JsonValue,
    created_at: DateTime<Utc>,
}

impl From<DeveloperAuthAuditRow> for DeveloperAuthAuditEntry {
    fn from(value: DeveloperAuthAuditRow) -> Self {
        Self {
            id: value.id,
            admin_id: value.admin_id,
            admin_email: value.admin_email,
            action: value.action,
            developer_account_id: value.developer_account_id,
            api_key_id: value.api_key_id,
            metadata: value.metadata,
            created_at: value.created_at,
        }
    }
}

#[async_trait]
impl DeveloperAuthRepo for PostgresPersistence {
    async fn create_developer_account(
        &self,
        public_id: &str,
        name: &str,
    ) -> AppResult<DeveloperAccount> {
        let row = sqlx::query_as::<_, DeveloperAccountRow>(
            r#"
                INSERT INTO developer_accounts (id, public_id, name)
                VALUES ($1, $2, $3)
                RETURNING id, public_id, name, is_frozen, created_at, updated_at
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(public_id)
        .bind(name)
        .fetch_one(&self.pool)
        .await
        .map_err(AppError::from)?;
        Ok(row.into())
    }

    async fn list_developer_accounts(
        &self,
        query: Option<&str>,
        limit: i64,
        offset: i64,
    ) -> AppResult<Vec<DeveloperAccount>> {
        let pattern = query
            .map(|q| format!("%{}%", q.trim().to_lowercase()))
            .unwrap_or_else(|| "%".to_string());
        let rows = sqlx::query_as::<_, DeveloperAccountRow>(
            r#"
                SELECT id, public_id, name, is_frozen, created_at, updated_at
                FROM developer_accounts
                WHERE LOWER(public_id) LIKE $1 OR LOWER(name) LIKE $1
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
            "#,
        )
        .bind(pattern)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::from)?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn count_developer_accounts(&self, query: Option<&str>) -> AppResult<i64> {
        let pattern = query
            .map(|q| format!("%{}%", q.trim().to_lowercase()))
            .unwrap_or_else(|| "%".to_string());
        let count: i64 = sqlx::query_scalar(
            r#"
                SELECT COUNT(*)
                FROM developer_accounts
                WHERE LOWER(public_id) LIKE $1 OR LOWER(name) LIKE $1
            "#,
        )
        .bind(pattern)
        .fetch_one(&self.pool)
        .await
        .map_err(AppError::from)?;
        Ok(count)
    }

    async fn get_developer_account(&self, account_id: Uuid) -> AppResult<Option<DeveloperAccount>> {
        let row = sqlx::query_as::<_, DeveloperAccountRow>(
            r#"
                SELECT id, public_id, name, is_frozen, created_at, updated_at
                FROM developer_accounts
                WHERE id = $1
            "#,
        )
        .bind(account_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::from)?;
        Ok(row.map(Into::into))
    }

    async fn get_developer_account_by_public_id(
        &self,
        public_id: &str,
    ) -> AppResult<Option<DeveloperAccount>> {
        let row = sqlx::query_as::<_, DeveloperAccountRow>(
            r#"
                SELECT id, public_id, name, is_frozen, created_at, updated_at
                FROM developer_accounts
                WHERE public_id = $1
            "#,
        )
        .bind(public_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::from)?;
        Ok(row.map(Into::into))
    }

    async fn set_developer_account_frozen(
        &self,
        account_id: Uuid,
        is_frozen: bool,
    ) -> AppResult<()> {
        sqlx::query("UPDATE developer_accounts SET is_frozen = $2 WHERE id = $1")
            .bind(account_id)
            .bind(is_frozen)
            .execute(&self.pool)
            .await
            .map_err(AppError::from)?;
        Ok(())
    }

    async fn create_api_key(
        &self,
        developer_account_id: Uuid,
        name: &str,
        key_prefix: &str,
        key_hash: &str,
        expires_at: Option<DateTime<Utc>>,
    ) -> AppResult<DeveloperApiKey> {
        let row = sqlx::query_as::<_, DeveloperApiKeyRow>(
            r#"
                INSERT INTO developer_api_keys
                    (id, developer_account_id, name, key_prefix, key_hash, expires_at)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, developer_account_id, name, key_prefix, created_at, updated_at,
                          last_used_at, revoked_at, expires_at
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(developer_account_id)
        .bind(name)
        .bind(key_prefix)
        .bind(key_hash)
        .bind(expires_at)
        .fetch_one(&self.pool)
        .await
        .map_err(AppError::from)?;
        Ok(row.into())
    }

    async fn list_api_keys(&self, developer_account_id: Uuid) -> AppResult<Vec<DeveloperApiKey>> {
        let rows = sqlx::query_as::<_, DeveloperApiKeyRow>(
            r#"
                SELECT id, developer_account_id, name, key_prefix, created_at, updated_at,
                       last_used_at, revoked_at, expires_at
                FROM developer_api_keys
                WHERE developer_account_id = $1
                ORDER BY created_at DESC
            "#,
        )
        .bind(developer_account_id)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::from)?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn get_api_key(&self, api_key_id: Uuid) -> AppResult<Option<DeveloperApiKey>> {
        let row = sqlx::query_as::<_, DeveloperApiKeyRow>(
            r#"
                SELECT id, developer_account_id, name, key_prefix, created_at, updated_at,
                       last_used_at, revoked_at, expires_at
                FROM developer_api_keys
                WHERE id = $1
            "#,
        )
        .bind(api_key_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::from)?;
        Ok(row.map(Into::into))
    }

    async fn lookup_api_key_by_hash(&self, key_hash: &str) -> AppResult<Option<ApiKeyWithOwner>> {
        let row = sqlx::query_as::<_, ApiKeyLookupRow>(
            r#"
                SELECT
                    k.id AS api_key_id,
                    k.developer_account_id,
                    k.name AS api_key_name,
                    k.key_prefix,
                    k.created_at AS api_key_created_at,
                    k.updated_at AS api_key_updated_at,
                    k.last_used_at AS api_key_last_used_at,
                    k.revoked_at AS api_key_revoked_at,
                    k.expires_at AS api_key_expires_at,
                    a.public_id AS account_public_id,
                    a.name AS account_name,
                    a.is_frozen AS account_is_frozen,
                    a.created_at AS account_created_at,
                    a.updated_at AS account_updated_at
                FROM developer_api_keys k
                INNER JOIN developer_accounts a ON a.id = k.developer_account_id
                WHERE k.key_hash = $1
            "#,
        )
        .bind(key_hash)
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::from)?;
        Ok(row.map(Into::into))
    }

    async fn revoke_api_key(&self, api_key_id: Uuid) -> AppResult<()> {
        sqlx::query(
            r#"
                UPDATE developer_api_keys
                SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
                WHERE id = $1
            "#,
        )
        .bind(api_key_id)
        .execute(&self.pool)
        .await
        .map_err(AppError::from)?;
        Ok(())
    }

    async fn touch_api_key_last_used(&self, api_key_id: Uuid) -> AppResult<()> {
        sqlx::query("UPDATE developer_api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1")
            .bind(api_key_id)
            .execute(&self.pool)
            .await
            .map_err(AppError::from)?;
        Ok(())
    }

    async fn create_scope(
        &self,
        api_key_id: Uuid,
        resource_type: ScopeResourceType,
        match_type: ScopeMatchType,
        resource_value: Option<&str>,
        can_read: bool,
        can_write: bool,
    ) -> AppResult<DeveloperApiKeyScope> {
        let row = sqlx::query_as::<_, DeveloperApiKeyScopeRow>(
            r#"
                INSERT INTO developer_api_key_scopes
                    (id, api_key_id, resource_type, match_type, resource_value, can_read, can_write)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id, api_key_id, resource_type, match_type, resource_value,
                          can_read, can_write, created_at
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(api_key_id)
        .bind(resource_type.to_string())
        .bind(match_type.to_string())
        .bind(resource_value)
        .bind(can_read)
        .bind(can_write)
        .fetch_one(&self.pool)
        .await
        .map_err(AppError::from)?;
        row.try_into()
    }

    async fn list_scopes(&self, api_key_id: Uuid) -> AppResult<Vec<DeveloperApiKeyScope>> {
        let rows = sqlx::query_as::<_, DeveloperApiKeyScopeRow>(
            r#"
                SELECT id, api_key_id, resource_type, match_type, resource_value,
                       can_read, can_write, created_at
                FROM developer_api_key_scopes
                WHERE api_key_id = $1
                ORDER BY created_at DESC
            "#,
        )
        .bind(api_key_id)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::from)?;
        rows.into_iter().map(TryInto::try_into).collect()
    }

    async fn get_scope(&self, scope_id: Uuid) -> AppResult<Option<DeveloperApiKeyScope>> {
        let row = sqlx::query_as::<_, DeveloperApiKeyScopeRow>(
            r#"
                SELECT id, api_key_id, resource_type, match_type, resource_value,
                       can_read, can_write, created_at
                FROM developer_api_key_scopes
                WHERE id = $1
            "#,
        )
        .bind(scope_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::from)?;
        row.map(TryInto::try_into).transpose()
    }

    async fn delete_scope(&self, scope_id: Uuid) -> AppResult<()> {
        sqlx::query("DELETE FROM developer_api_key_scopes WHERE id = $1")
            .bind(scope_id)
            .execute(&self.pool)
            .await
            .map_err(AppError::from)?;
        Ok(())
    }

    async fn log_developer_auth_audit(&self, entry: NewDeveloperAuthAuditEntry) -> AppResult<()> {
        sqlx::query(
            r#"
                INSERT INTO developer_auth_audit_log
                    (admin_id, admin_email, action, developer_account_id, api_key_id, metadata)
                VALUES ($1, $2, $3, $4, $5, $6)
            "#,
        )
        .bind(entry.admin_id)
        .bind(entry.admin_email)
        .bind(entry.action)
        .bind(entry.developer_account_id)
        .bind(entry.api_key_id)
        .bind(entry.metadata)
        .execute(&self.pool)
        .await
        .map_err(AppError::from)?;
        Ok(())
    }

    async fn list_developer_auth_audit(
        &self,
        limit: i64,
        offset: i64,
    ) -> AppResult<Vec<DeveloperAuthAuditEntry>> {
        let rows = sqlx::query_as::<_, DeveloperAuthAuditRow>(
            r#"
                SELECT id, admin_id, admin_email, action, developer_account_id, api_key_id,
                       metadata, created_at
                FROM developer_auth_audit_log
                ORDER BY created_at DESC
                LIMIT $1 OFFSET $2
            "#,
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::from)?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn count_developer_auth_audit(&self) -> AppResult<i64> {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM developer_auth_audit_log")
            .fetch_one(&self.pool)
            .await
            .map_err(AppError::from)?;
        Ok(count)
    }
}

fn parse_resource_type(value: &str) -> AppResult<ScopeResourceType> {
    match value {
        "bucket" => Ok(ScopeResourceType::Bucket),
        other => Err(AppError::Internal(format!(
            "unknown scope resource type in storage: {other}"
        ))),
    }
}

fn parse_match_type(value: &str) -> AppResult<ScopeMatchType> {
    match value {
        "all" => Ok(ScopeMatchType::All),
        "exact" => Ok(ScopeMatchType::Exact),
        "prefix" => Ok(ScopeMatchType::Prefix),
        other => Err(AppError::Internal(format!(
            "unknown scope match type in storage: {other}"
        ))),
    }
}
