use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

use crate::{
    adapters::persistence::PostgresPersistence,
    app_error::{AppError, AppResult},
    application::language::UserLanguage,
    use_cases::user::{UserProfile, UserRepo, UserStats},
};

#[derive(sqlx::FromRow, Debug, Serialize)]
pub struct UserDb {
    pub id: Uuid,
    pub email: String,
    pub language: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_login_at: Option<DateTime<Utc>>,
    pub is_admin: bool,
    pub is_frozen: bool,
}

impl From<UserDb> for UserProfile {
    fn from(r: UserDb) -> Self {
        UserProfile {
            id: r.id,
            email: r.email,
            language: r.language,
            created_at: r.created_at,
            updated_at: r.updated_at,
            last_login_at: r.last_login_at,
            is_admin: r.is_admin,
            is_frozen: r.is_frozen,
        }
    }
}

#[async_trait]
impl UserRepo for PostgresPersistence {
    async fn upsert_by_email(&self, email: &str, language: Option<&str>) -> AppResult<UserProfile> {
        let lang = UserLanguage::from_raw(language.map(|l| l.trim()));
        let id = Uuid::new_v4();
        let rec = sqlx::query_as!(
            UserDb,
            r#"
                INSERT INTO users (id, email, language)
                VALUES ($1, $2, $3)
                ON CONFLICT (email) DO UPDATE
                SET language = COALESCE($3, users.language)
                RETURNING id, email, language, created_at, updated_at, last_login_at, is_admin, is_frozen
            "#,
            id,
            email,
            lang.as_str(),
        )
        .fetch_one(&self.pool)
        .await
        .map_err(AppError::from)?;
        Ok(rec.into())
    }

    async fn get_profile_by_id(&self, user_id: Uuid) -> AppResult<Option<UserProfile>> {
        let rec = sqlx::query_as!(
            UserDb,
            r#"
                SELECT id, email, language, created_at, updated_at, last_login_at, is_admin, is_frozen
                FROM users WHERE id = $1
            "#,
            user_id
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::from)?;
        Ok(rec.map(Into::into))
    }

    async fn update_language(&self, user_id: Uuid, language: &str) -> AppResult<()> {
        let lang = UserLanguage::from_raw(Some(language.trim()));
        sqlx::query!(
            "UPDATE users SET language = $2 WHERE id = $1",
            user_id,
            lang.as_str()
        )
        .execute(&self.pool)
        .await
        .map_err(AppError::from)?;
        Ok(())
    }

    async fn delete_user(&self, user_id: Uuid) -> AppResult<()> {
        sqlx::query!("DELETE FROM users WHERE id = $1", user_id)
            .execute(&self.pool)
            .await
            .map_err(AppError::from)?;
        Ok(())
    }

    async fn set_admin(&self, user_id: Uuid, is_admin: bool) -> AppResult<()> {
        sqlx::query!(
            "UPDATE users SET is_admin = $2 WHERE id = $1",
            user_id,
            is_admin
        )
        .execute(&self.pool)
        .await
        .map_err(AppError::from)?;
        Ok(())
    }

    async fn set_frozen(&self, user_id: Uuid, is_frozen: bool) -> AppResult<()> {
        sqlx::query!(
            "UPDATE users SET is_frozen = $2 WHERE id = $1",
            user_id,
            is_frozen
        )
        .execute(&self.pool)
        .await
        .map_err(AppError::from)?;
        Ok(())
    }

    async fn touch_last_login(&self, user_id: Uuid) -> AppResult<()> {
        sqlx::query!(
            "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1",
            user_id
        )
        .execute(&self.pool)
        .await
        .map_err(AppError::from)?;
        Ok(())
    }

    async fn list_users(
        &self,
        query: Option<&str>,
        limit: i64,
        offset: i64,
    ) -> AppResult<Vec<UserProfile>> {
        let pattern = query
            .map(|q| format!("%{}%", q.trim().to_lowercase()))
            .unwrap_or_else(|| "%".to_string());
        let rows = sqlx::query_as!(
            UserDb,
            r#"
                SELECT id, email, language, created_at, updated_at, last_login_at, is_admin, is_frozen
                FROM users
                WHERE LOWER(email) LIKE $1
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
            "#,
            pattern,
            limit,
            offset
        )
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::from)?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn count_users(&self, query: Option<&str>) -> AppResult<i64> {
        let pattern = query
            .map(|q| format!("%{}%", q.trim().to_lowercase()))
            .unwrap_or_else(|| "%".to_string());
        let row = sqlx::query!(
            "SELECT COUNT(*) as count FROM users WHERE LOWER(email) LIKE $1",
            pattern
        )
        .fetch_one(&self.pool)
        .await
        .map_err(AppError::from)?;
        Ok(row.count.unwrap_or(0))
    }

    async fn stats(&self) -> AppResult<UserStats> {
        let row = sqlx::query!(
            r#"
                SELECT
                    COUNT(*) AS "total!",
                    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS "last_7!",
                    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS "last_30!",
                    COUNT(*) FILTER (WHERE is_frozen) AS "frozen!",
                    COUNT(*) FILTER (WHERE is_admin) AS "admin!"
                FROM users
            "#
        )
        .fetch_one(&self.pool)
        .await
        .map_err(AppError::from)?;
        Ok(UserStats {
            total_users: row.total,
            users_last_7_days: row.last_7,
            users_last_30_days: row.last_30,
            frozen_users: row.frozen,
            admin_users: row.admin,
        })
    }
}
