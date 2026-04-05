FROM rust:1.90-slim-bookworm AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Pre-fetch dependencies for faster incremental builds
COPY Cargo.toml ./
RUN mkdir -p src && echo "fn main() {}" > src/main.rs
RUN cargo fetch

# Build application
RUN rm -rf src
COPY . .
ENV SQLX_OFFLINE=true
RUN cargo build --release --bin user-gateway

FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/user-gateway /usr/local/bin/user-gateway
COPY migrations ./migrations

ENV RUST_LOG=info
EXPOSE 3001

CMD ["user-gateway"]
