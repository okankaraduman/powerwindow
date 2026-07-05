# BestTimePower iOS

Native SwiftUI version of the Power Window app.

## Create the Xcode app

1. Open Xcode.
2. Create a new iOS App project named `BestTimePower`.
3. Choose SwiftUI and Swift.
4. Replace the generated Swift files with the files in this folder:
   - `BestTimePowerApp.swift`
   - `ContentView.swift`
   - `Models.swift`
   - `REEClient.swift`

The app fetches REE market prices, ranks the cheapest flexible-load windows, and falls back
to clearly labeled demo data when the API is unavailable.
