#!/bin/bash
# Double-click this file in Finder (or run in Terminal) to accept the Xcode license.
# macOS will ask for your Mac login password once — required by Apple, not optional.
set -e
echo "Accepting Xcode license (password required)…"
sudo xcodebuild -license accept
echo ""
echo "Done. Opening Teleprompter in Xcode…"
open -a Xcode "/Users/ely/Teleprompter/Teleprompter.xcodeproj"
echo ""
echo "Next in Xcode:"
echo "  • Teleprompter target → Signing → Team → your Apple ID"
echo "  • Select your iPhone at the top → Run (⌘R)"
