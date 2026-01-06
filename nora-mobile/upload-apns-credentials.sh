#!/bin/bash

# APNs Credentials Upload Script
# This script will guide you through uploading APNs credentials to EAS

echo "================================================================================
APNs Credentials Upload
================================================================================
"
echo "Team ID: FJRP6385Q9"
echo "Key ID: WSQ56Z7FXD"
echo "P8 File: /Users/mia/Downloads/AuthKey_WSQ56Z7FXD.p8"
echo ""
echo "Starting EAS credentials manager..."
echo ""
echo "================================================================================
When prompted, select the following options:
================================================================================
1. Select platform: iOS
2. Select: production (or development for testing)
3. Select: Push Notifications: Manage your Apple Push Notification Key
4. Select: Add a new Push Key
5. Enter Key ID: WSQ56Z7FXD
6. Enter path to P8 file: /Users/mia/Downloads/AuthKey_WSQ56Z7FXD.p8
7. Enter Team ID: FJRP6385Q9
================================================================================
"
read -p "Press Enter to continue..."

cd /Users/mia/nora/nora-mobile
eas credentials
