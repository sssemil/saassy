use crate::{
    adapters::{email::resend::ResendEmailSender, http::app_state::AppState},
    infra::{
        config::AppConfig, magic_links::MagicLinkStore, postgres_persistence,
        rate_limit::RateLimiter,
    },
    use_cases::{
        audit::AuditLogRepo,
        developer_auth::{DeveloperAuthRepo, DeveloperAuthUseCases},
        user::{AuthUseCases, UserRepo},
    },
};
use std::fs::File;
use std::sync::Arc;
use tracing_subscriber::{EnvFilter, fmt, layer::SubscriberExt, util::SubscriberInitExt};

pub async fn init_app_state() -> anyhow::Result<AppState> {
    let config = AppConfig::from_env();

    let postgres_arc = Arc::new(postgres_persistence(&config.database_url).await?);

    let rate_limiter = Arc::new(
        RateLimiter::new(
            &config.redis_url,
            config.rate_limit_window_secs,
            config.rate_limit_per_ip,
            config.rate_limit_per_email,
        )
        .await?,
    );

    let magic_links = Arc::new(MagicLinkStore::new(&config.redis_url).await?);

    let email = Arc::new(ResendEmailSender::new(
        config.resend_api_key.clone(),
        config.email_from.clone(),
    ));

    let user_repo_arc = postgres_arc.clone() as Arc<dyn UserRepo>;
    let audit_repo_arc = postgres_arc.clone() as Arc<dyn AuditLogRepo>;
    let developer_auth_repo_arc = postgres_arc.clone() as Arc<dyn DeveloperAuthRepo>;

    let auth_use_cases = AuthUseCases::new(
        user_repo_arc.clone(),
        magic_links,
        email.clone(),
        config.app_origin.to_string(),
    );
    let developer_auth_use_cases = DeveloperAuthUseCases::new(
        developer_auth_repo_arc.clone(),
        config.machine_auth_positive_cache_ttl_ms,
    );

    Ok(AppState {
        config: Arc::new(config),
        auth_use_cases: Arc::new(auth_use_cases),
        developer_auth_use_cases: Arc::new(developer_auth_use_cases),
        user_repo: user_repo_arc,
        audit_repo: audit_repo_arc,
        developer_auth_repo: developer_auth_repo_arc,
        rate_limiter,
    })
}

pub fn init_tracing() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| "common_saas_template=debug,tower_http=debug".into());

    let console_layer = fmt::layer().with_target(false).with_level(true).pretty();

    let file = File::create("app.log").expect("cannot create log file");
    let json_layer = fmt::layer()
        .json()
        .with_writer(file)
        .with_current_span(true)
        .with_span_list(true);

    tracing_subscriber::registry()
        .with(filter)
        .with(console_layer)
        .with(json_layer)
        .try_init()
        .ok();
}
