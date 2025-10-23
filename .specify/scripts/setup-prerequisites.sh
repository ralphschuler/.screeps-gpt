#!/usr/bin/env bash
# Setup and verify prerequisites for spec-kit integration

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Checking spec-kit prerequisites..."
echo ""

# Check if running in supported environment
check_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]] || [[ "$OSTYPE" == "darwin"* ]]; then
        echo -e "${GREEN}✓${NC} Operating system: $OSTYPE"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} Operating system: $OSTYPE (may have limited support)"
        return 1
    fi
}

# Check Python version
check_python() {
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
        PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d'.' -f1)
        PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d'.' -f2)
        
        if [[ "$PYTHON_MAJOR" -ge 3 ]] && [[ "$PYTHON_MINOR" -ge 11 ]]; then
            echo -e "${GREEN}✓${NC} Python $PYTHON_VERSION (>= 3.11 required)"
            return 0
        else
            echo -e "${RED}✗${NC} Python $PYTHON_VERSION (>= 3.11 required)"
            echo "  Install Python 3.11+: https://www.python.org/downloads/"
            return 1
        fi
    else
        echo -e "${RED}✗${NC} Python 3 not found"
        echo "  Install Python 3.11+: https://www.python.org/downloads/"
        return 1
    fi
}

# Check uv package manager
check_uv() {
    if command -v uv &> /dev/null; then
        UV_VERSION=$(uv --version | cut -d' ' -f2)
        echo -e "${GREEN}✓${NC} uv $UV_VERSION"
        return 0
    else
        echo -e "${RED}✗${NC} uv not found"
        echo "  Install: curl -LsSf https://astral.sh/uv/install.sh | sh"
        return 1
    fi
}

# Check spec-kit CLI
check_specify() {
    if command -v specify &> /dev/null; then
        echo -e "${GREEN}✓${NC} specify CLI installed"
        
        # Run specify check
        echo ""
        echo "Running 'specify check'..."
        specify check || true
        return 0
    else
        echo -e "${RED}✗${NC} specify CLI not found"
        echo "  Install: uv tool install specify-cli --from git+https://github.com/github/spec-kit.git"
        return 1
    fi
}

# Check Git
check_git() {
    if command -v git &> /dev/null; then
        GIT_VERSION=$(git --version | cut -d' ' -f3)
        echo -e "${GREEN}✓${NC} Git $GIT_VERSION"
        return 0
    else
        echo -e "${RED}✗${NC} Git not found"
        echo "  Install: https://git-scm.com/downloads"
        return 1
    fi
}

# Check Node.js (for this project)
check_node() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version | cut -d'v' -f2)
        echo -e "${GREEN}✓${NC} Node.js $NODE_VERSION"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} Node.js not found (required for this project)"
        return 1
    fi
}

# Check directory structure
check_structure() {
    if [[ -d ".specify" ]] && \
       [[ -f ".specify/memory/constitution.md" ]] && \
       [[ -d ".specify/templates" ]] && \
       [[ -d ".specify/scripts" ]] && \
       [[ -d ".specify/specs" ]]; then
        echo -e "${GREEN}✓${NC} .specify directory structure"
        return 0
    else
        echo -e "${RED}✗${NC} .specify directory structure incomplete"
        echo "  Expected structure:"
        echo "    .specify/"
        echo "    ├── memory/constitution.md"
        echo "    ├── scripts/"
        echo "    ├── specs/"
        echo "    └── templates/"
        return 1
    fi
}

# Main execution
main() {
    local failures=0
    
    check_os || ((failures++))
    check_python || ((failures++))
    check_git || ((failures++))
    check_uv || ((failures++))
    check_specify || ((failures++))
    check_node || ((failures++))
    echo ""
    check_structure || ((failures++))
    
    echo ""
    if [[ $failures -eq 0 ]]; then
        echo -e "${GREEN}✓ All prerequisites met!${NC}"
        echo ""
        echo "Next steps:"
        echo "  1. Launch your AI assistant (code, claude, etc.)"
        echo "  2. Use /speckit.specify to create a feature specification"
        echo "  3. Follow the spec-driven development workflow"
        echo ""
        echo "See .specify/README.md for detailed instructions."
        return 0
    else
        echo -e "${RED}✗ $failures prerequisite(s) missing${NC}"
        echo ""
        echo "Install missing prerequisites and run this script again."
        return 1
    fi
}

main "$@"
