use std::sync::Arc;

use async_trait::async_trait;
use base64::Engine;
use sha2::{Digest, Sha256};
use tracing::instrument;
use uuid::Uuid;

use crate::app_error::AppResult;
use crate::application::{
    email_templates::{primary_button, wrap_email},
    language::UserLanguage,
};

#[async_trait]
pub trait UserRepo: Send + Sync {
    async fn upsert_by_email(&self, email: &str, language: Option<&str>) -> AppResult<UserProfile>;
    async fn get_profile_by_id(&self, user_id: Uuid) -> AppResult<Option<UserProfile>>;
    async fn update_language(&self, user_id: Uuid, language: &str) -> AppResult<()>;
    async fn delete_user(&self, user_id: Uuid) -> AppResult<()>;
    async fn set_admin(&self, user_id: Uuid, is_admin: bool) -> AppResult<()>;
    async fn set_frozen(&self, user_id: Uuid, is_frozen: bool) -> AppResult<()>;
    async fn touch_last_login(&self, user_id: Uuid) -> AppResult<()>;
    async fn list_users(
        &self,
        query: Option<&str>,
        limit: i64,
        offset: i64,
    ) -> AppResult<Vec<UserProfile>>;
    async fn count_users(&self, query: Option<&str>) -> AppResult<i64>;
    async fn stats(&self) -> AppResult<UserStats>;
}

#[derive(Debug, Clone)]
pub struct UserStats {
    pub total_users: i64,
    pub users_last_7_days: i64,
    pub users_last_30_days: i64,
    pub frozen_users: i64,
    pub admin_users: i64,
}

#[async_trait]
pub trait EmailSender: Send + Sync {
    async fn send(&self, to: &str, subject: &str, html: &str) -> AppResult<()>;
}

#[async_trait]
pub trait MagicLinkStore: Send + Sync {
    async fn save(&self, token_hash: &str, user_id: Uuid, ttl_minutes: i64) -> AppResult<()>;
    async fn consume(&self, token_hash: &str) -> AppResult<Option<Uuid>>;
}

#[derive(Clone)]
pub struct AuthUseCases {
    repo: Arc<dyn UserRepo>,
    magic_links: Arc<dyn MagicLinkStore>,
    email: Arc<dyn EmailSender>,
    app_origin: String,
}

impl AuthUseCases {
    pub fn new(
        repo: Arc<dyn UserRepo>,
        magic_links: Arc<dyn MagicLinkStore>,
        email: Arc<dyn EmailSender>,
        app_origin: String,
    ) -> Self {
        Self {
            repo,
            magic_links,
            email,
            app_origin,
        }
    }

    #[instrument(skip(self))]
    pub async fn request_magic_link(
        &self,
        email: &str,
        session_id: &str,
        ttl_minutes: i64,
        language: Option<&str>,
    ) -> AppResult<()> {
        let requested_lang = UserLanguage::from_raw(language);
        let profile = self
            .repo
            .upsert_by_email(email, Some(requested_lang.as_str()))
            .await?;
        let user_id = profile.id;
        let lang = UserLanguage::from_raw(Some(&profile.language));
        let raw = generate_token();
        let token_hash = hash_token(&raw, session_id);
        self.magic_links
            .save(&token_hash, user_id, ttl_minutes)
            .await?;
        let link = format!(
            "{}/magic?token={}",
            self.app_origin.trim_end_matches('/'),
            raw
        );
        let (subject, headline, lead, button_label, reason, footer_note) = match lang {
            UserLanguage::En => (
                "Sign in",
                "Your sign-in link is ready",
                format!(
                    "Use this secure link to finish signing in. It expires in {} minutes.",
                    ttl_minutes
                ),
                "Continue",
                format!(
                    "you asked to sign in to {}",
                    self.app_origin.trim_end_matches('/')
                ),
                "This one-time link keeps your account protected; delete this email if you did not request it.",
            ),
            UserLanguage::De => (
                "Anmelden",
                "Dein Anmeldelink ist startklar",
                format!(
                    "Nutze diesen sicheren Link, um dich anzumelden. Er läuft in {} Minuten ab.",
                    ttl_minutes
                ),
                "Weiter",
                format!(
                    "du hast dich auf {} angemeldet",
                    self.app_origin.trim_end_matches('/')
                ),
                "Dieser einmalige Link schützt deinen Zugang; lösche die E-Mail, falls du sie nicht angefordert hast.",
            ),
        };
        let button = primary_button(&link, button_label);
        let html = wrap_email(
            lang,
            &self.app_origin,
            headline,
            &lead,
            &format!(
                "{button}<p style=\"margin:12px 0 0;font-size:14px;color:#4b5563;\">{fallback}</p>",
                fallback = match lang {
                    UserLanguage::En => format!(
                        "If the button does not work, copy and paste this URL:<br><span style=\"word-break:break-all;color:#111827;\">{link}</span>"
                    ),
                    UserLanguage::De => format!(
                        "Falls der Button nicht funktioniert, kopiere diesen Link:<br><span style=\"word-break:break-all;color:#111827;\">{link}</span>"
                    ),
                }
            ),
            &reason,
            Some(footer_note),
        );
        self.email.send(&profile.email, subject, &html).await
    }

    #[instrument(skip(self))]
    pub async fn consume_magic_link(
        &self,
        raw_token: &str,
        session_id: &str,
    ) -> AppResult<Option<Uuid>> {
        let token_hash = hash_token(raw_token, session_id);
        if let Some(user_id) = self.magic_links.consume(&token_hash).await? {
            return Ok(Some(user_id));
        }
        Ok(None)
    }

    #[instrument(skip(self))]
    pub async fn delete_account(&self, user_id: Uuid, lang_header: Option<&str>) -> AppResult<()> {
        let profile = self
            .repo
            .get_profile_by_id(user_id)
            .await?
            .ok_or(crate::app_error::AppError::InvalidCredentials)?;
        let lang = UserLanguage::from_raw(lang_header.or(Some(&profile.language)));

        let (subject, headline, lead, body_text, reason, footer) = match lang {
            UserLanguage::En => (
                "Your account has been deleted",
                "Account deleted",
                "Your account and associated data have been removed.",
                "If this was a mistake, please sign up again to create a new account.",
                format!(
                    "you requested to delete your account on {}",
                    self.app_origin.trim_end_matches('/')
                ),
                "If you didn't request this, please contact support immediately.",
            ),
            UserLanguage::De => (
                "Dein Konto wurde gelöscht",
                "Konto gelöscht",
                "Dein Konto und die zugehörigen Daten wurden entfernt.",
                "Falls das ein Versehen war, melde dich einfach neu an.",
                format!(
                    "du hast die Löschung deines Kontos auf {} angefordert",
                    self.app_origin.trim_end_matches('/')
                ),
                "Falls du das nicht warst, kontaktiere bitte sofort den Support.",
            ),
        };
        let body = wrap_email(
            lang,
            &self.app_origin,
            headline,
            lead,
            &format!(
                "<p style=\"margin:12px 0 0;color:#374151;\">{}</p>",
                body_text
            ),
            &reason,
            Some(footer),
        );

        self.repo.delete_user(user_id).await?;
        let _ = self.email.send(&profile.email, subject, &body).await;
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct UserProfile {
    pub id: Uuid,
    pub email: String,
    pub language: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub last_login_at: Option<chrono::DateTime<chrono::Utc>>,
    pub is_admin: bool,
    pub is_frozen: bool,
}

fn generate_token() -> String {
    use rand::RngCore;
    let mut bytes = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

fn hash_token(raw: &str, session_id: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    hasher.update(session_id.as_bytes());
    let out = hasher.finalize();
    hex::encode(out)
}
