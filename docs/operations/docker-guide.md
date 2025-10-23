# Docker Development Guide

This guide explains how to use Docker containers for development, testing, and building in the Screeps GPT repository.

## Overview

The repository provides Docker containerization for:

- **Testing**: Isolated test environments with specific Node.js versions
- **Building**: Consistent build environments
- **Development**: Complete development setup with hot-reload support
- **CI/CD Integration**: Reproducible environments matching CI pipelines

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 20.10 or later
- [Docker Compose](https://docs.docker.com/compose/install/) v2.0 or later (typically included with Docker Desktop)

## Available Containers

### Test Container (`Dockerfile.test`)

**Purpose**: Run unit, end-to-end, and regression tests

**Environment**:

- Node.js 20 (required for Vitest 4.x)
- Python 2.7 (for native dependency compilation)
- Full test dependencies

**Usage**:

```bash
# Run unit tests
npm run docker:test:unit

# Run end-to-end tests
npm run docker:test:e2e

# Run regression tests
npm run docker:test:regression

# Run all tests with coverage
npm run docker:test:coverage

# Interactive shell for debugging
npm run docker:shell
```

### Build Container (`Dockerfile.build`)

**Purpose**: Build the Screeps AI bundle

**Environment**:

- Node.js 20
- Build dependencies (esbuild, TypeScript, tsx)
- No optional dependencies (lightweight)

**Usage**:

```bash
# Build the AI
npm run docker:build:ai

# The built bundle will be available in dist/main.js
```

### Mockup Container (`Dockerfile.mockup`)

**Purpose**: Run screeps-server-mockup tests (requires Node.js 16)

**Environment**:

- Node.js 16.20.2 (last version supporting Python 2 native modules)
- Python 2.7
- screeps-server-mockup and isolated-vm dependencies

**Usage**:

```bash
# Run mockup tests
npm run docker:test:mockup
```

**Note**: This container is separate because screeps-server-mockup requires Node.js 16 with Python 2 for the isolated-vm native module.

## Development Workflow

### Initial Setup

1. **Build containers**:

   ```bash
   npm run docker:build
   ```

2. **Run tests to verify setup**:
   ```bash
   npm run docker:test:unit
   ```

### Iterative Development

The containers use volume mounting to reflect local changes immediately:

```bash
# Start development server with hot-reload
npm run docker:dev

# In another terminal, make code changes
# The dev container will automatically rebuild
```

### Quality Checks

Run linting and formatting checks:

```bash
# Run ESLint
npm run docker:lint

# Check formatting
npm run docker:format
```

### Interactive Debugging

Access a shell inside the test container for debugging:

```bash
npm run docker:shell

# Inside the container:
node --version  # Check Node version
npm run test:unit  # Run tests manually
npm run build  # Build manually
exit  # Exit the container
```

## Docker Compose Services

The `docker-compose.yml` file defines multiple services:

### `dev` Service

- **Purpose**: Development with hot-reload
- **Command**: `npm run build:watch`
- **Volumes**: Full workspace with node_modules excluded

### `test` Service

- **Purpose**: Testing environment
- **Command**: Configurable (unit, e2e, regression tests)
- **Volumes**: Workspace with node_modules excluded

### `build` Service

- **Purpose**: Build the AI bundle
- **Command**: `npm run build`
- **Volumes**: Workspace with node_modules excluded

### `lint` Service

- **Purpose**: Run linting checks
- **Command**: `npm run lint`

### `format` Service

- **Purpose**: Check code formatting
- **Command**: `npm run format:check`

### `mockup` Service

- **Purpose**: Run mockup tests (Node.js 16)
- **Command**: `npm run test:mockup`

## Volume Mounting Strategy

The containers use the following volume mounting strategy:

```yaml
volumes:
  - .:/workspace # Mount entire workspace
  - /workspace/node_modules # Exclude node_modules (use container's version)
```

This ensures:

- Code changes are immediately available in containers
- Container-specific node_modules are isolated
- No conflicts between host and container dependencies

## Security Considerations

### SSL Certificate Handling

The Dockerfiles disable strict SSL during `npm install` to handle self-signed certificates in containerized environments:

```dockerfile
RUN npm config set strict-ssl false && \
    npm install --legacy-peer-deps && \
    npm config set strict-ssl true
```

This is acceptable for development containers but should not be used in production deployments.

### Python 2 Dependencies

Python 2 is required for compiling native Node.js modules (isolated-vm in screeps-server-mockup). While Python 2 is EOL, it's necessary for maintaining compatibility with the Screeps testing infrastructure.

## CI/CD Integration

The Docker containers can be integrated into GitHub Actions workflows for consistency:

```yaml
# Example workflow step
- name: Run tests in Docker
  run: |
    docker compose build test
    docker compose run --rm test npm run test:unit
```

This ensures the CI environment matches local development environments.

## Troubleshooting

### Container Build Failures

**Problem**: npm install fails with SSL errors

**Solution**: The Dockerfiles already include SSL workarounds. If issues persist:

```bash
# Rebuild without cache
docker compose build --no-cache test
```

**Problem**: isolated-vm fails to build

**Solution**: This is expected in the build container, which excludes optional dependencies. Use the mockup container for isolated-vm tests:

```bash
npm run docker:test:mockup
```

### Volume Mounting Issues

**Problem**: Changes not reflected in container

**Solution**: Ensure Docker has access to the workspace directory:

- **macOS**: Check Docker Desktop → Preferences → Resources → File Sharing
- **Windows**: Check Docker Desktop → Settings → Resources → File Sharing
- **Linux**: Ensure user has Docker permissions

**Problem**: node_modules conflicts

**Solution**: Remove local node_modules and rebuild:

```bash
rm -rf node_modules
docker compose build test
```

### Performance Issues

**Problem**: Slow builds or tests

**Solution**:

1. **Increase Docker resources**: Docker Desktop → Preferences → Resources
2. **Use BuildKit**: Already enabled by default in Docker Compose v2
3. **Prune unused images**: `docker system prune -a`

### Permission Issues (Linux)

**Problem**: Permission denied when accessing files created by containers

**Solution**: The containers run as root by default. To match host user permissions:

```bash
# Run container with host user ID
docker compose run --rm --user $(id -u):$(id -g) test npm run test:unit
```

**Problem**: Cannot delete dist/ directory created by Docker build container

**Solution**: Files created by Docker containers are owned by root. Clean with:

```bash
sudo rm -rf dist
```

Alternatively, run the build container with host user permissions:

```bash
docker compose run --rm --user $(id -u):$(id -g) build
```

## Performance Optimization

### Build Caching

Docker layer caching is optimized by copying package files before source code:

```dockerfile
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps
COPY . .
```

This ensures dependency installation is cached unless package files change.

### Multi-Stage Builds

The build container is optimized by excluding optional dependencies:

```bash
npm install --no-optional
```

This reduces image size and build time when optional dependencies (like screeps-server-mockup) aren't needed.

## Version Requirements

### Node.js Versions

- **Test/Build Containers**: Node.js 20 (required for Vitest 4.x and modern tooling)
- **Mockup Container**: Node.js 16.20.2 (required for isolated-vm with Python 2)

### Python Version

- **All Containers**: Python 2.7.18 (required for node-gyp with legacy native modules)

## Migration from Local Development

To migrate from local development to Docker:

1. **Commit changes**: Ensure working tree is clean
2. **Build containers**: `npm run docker:build`
3. **Test compatibility**: `npm run docker:test:unit`
4. **Update workflows**: Replace local commands with `docker:*` equivalents
5. **Document changes**: Update team documentation

## Backward Compatibility

All existing npm commands continue to work without Docker:

```bash
# Traditional commands (still work)
npm run test:unit
npm run build
npm run lint

# Docker equivalents (new)
npm run docker:test:unit
npm run docker:build:ai
npm run docker:lint
```

This ensures gradual adoption without disrupting existing workflows.

## Related Documentation

- [Deployment Troubleshooting](./deployment-troubleshooting.md) - Deployment issues and solutions
- [Workflow Troubleshooting](./workflow-troubleshooting.md) - GitHub Actions debugging
- [Repository README](../../README.md) - Main repository documentation

## Future Enhancements

Potential improvements for Docker containerization:

1. **Multi-architecture builds**: Support for ARM64 (Apple Silicon)
2. **Production deployment container**: Optimized container for Screeps deployment
3. **Remote development**: VSCode Dev Containers integration
4. **CI/CD optimization**: Parallel container builds in GitHub Actions
5. **Kubernetes support**: Deployment configurations for K8s environments

## Support

For issues with Docker containerization:

1. Check [Troubleshooting](#troubleshooting) section
2. Review [GitHub Issues](https://github.com/ralphschuler/.screeps-gpt/issues)
3. Consult [Docker documentation](https://docs.docker.com/)
4. Ask in repository discussions
