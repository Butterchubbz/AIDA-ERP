# ==============================================================================
# AIDA-ERP — POCKETBASE SERVER DOCKERFILE
# ==============================================================================
FROM alpine:3.18

# Install tools needed to download and unpack PocketBase
RUN apk add --no-cache ca-certificates unzip wget jq

# Define authoritative PocketBase version (aligns with AIDA v0.30.0 spec)
ENV PB_VERSION=0.30.0

# Automatically resolve system architecture and fetch the correct PocketBase binary
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then \
        PB_ARCH="amd64"; \
    elif [ "$ARCH" = "aarch64" ]; then \
        PB_ARCH="arm64"; \
    else \
        PB_ARCH="amd64"; \
    fi && \
    wget https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip -O /tmp/pb.zip && \
    unzip /tmp/pb.zip -d /usr/local/bin/ && \
    rm /tmp/pb.zip

# Create and persist pocketbase database files in a separate directory
RUN mkdir /pb_data

# Expose the PocketBase service port (internal/admin traffic)
EXPOSE 8090

# Command to serve PocketBase, allowing connections from the container network
CMD ["pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb_data"]
