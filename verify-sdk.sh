#!/bin/bash

# Smart TV Deployer - SDK Verification Script
# This script checks if the required SDK tools are installed and accessible

echo "🔍 Smart TV Deployer - SDK Verification"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Tizen SDK
echo "📱 Checking Tizen SDK..."
if command -v tizen &> /dev/null; then
    echo -e "${GREEN}✓ tizen command found${NC}"
    tizen version 2>/dev/null || echo "  (installed)"
else
    echo -e "${RED}✗ tizen command not found${NC}"
    echo -e "${YELLOW}  Install from: https://developer.tizen.org/development/tizen-studio/download${NC}"
fi

if command -v sdb &> /dev/null; then
    echo -e "${GREEN}✓ sdb command found${NC}"
    sdb version 2>/dev/null || echo "  (installed)"
else
    echo -e "${RED}✗ sdb command not found${NC}"
    echo -e "${YELLOW}  Should be included with Tizen Studio${NC}"
fi

echo ""

# Check webOS SDK
echo "📺 Checking webOS SDK..."
if command -v ares-package &> /dev/null; then
    echo -e "${GREEN}✓ ares-package command found${NC}"
    ares-package --version 2>/dev/null || echo "  (installed)"
else
    echo -e "${RED}✗ ares-package command not found${NC}"
    echo -e "${YELLOW}  Install from: https://webostv.developer.lge.com/develop/tools/cli-installation${NC}"
fi

if command -v ares-install &> /dev/null; then
    echo -e "${GREEN}✓ ares-install command found${NC}"
else
    echo -e "${RED}✗ ares-install command not found${NC}"
fi

if command -v ares-launch &> /dev/null; then
    echo -e "${GREEN}✓ ares-launch command found${NC}"
else
    echo -e "${RED}✗ ares-launch command not found${NC}"
fi

if command -v ares-device-info &> /dev/null; then
    echo -e "${GREEN}✓ ares-device-info command found${NC}"
else
    echo -e "${RED}✗ ares-device-info command not found${NC}"
fi

echo ""
echo "========================================"
echo "Verification complete!"
echo ""
echo "To add SDK tools to your PATH, add these lines to your ~/.zshrc or ~/.bashrc:"
echo ""
echo "# Tizen SDK"
echo 'export PATH="$PATH:/path/to/tizen-studio/tools/ide/bin"'
echo 'export PATH="$PATH:/path/to/tizen-studio/tools"'
echo ""
echo "# webOS SDK"
echo 'export PATH="$PATH:/opt/webOS_TV_SDK/CLI/bin"'
echo ""
