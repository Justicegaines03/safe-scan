//
//  LockScreenWidgetControl.swift
//  LockScreenWidget
//
//  Created by Justice Gaines on 8/28/25.
//

import AppIntents
import SwiftUI
import WidgetKit

struct SafeScanWidgetControl: ControlWidget {
    static let kind: String = "com.justicegaines03.safe-scan.SafeScanWidget"

    var body: some ControlWidgetConfiguration {
        AppIntentControlConfiguration(
            kind: Self.kind,
            provider: Provider()
        ) { _ in
            ControlWidgetButton(action: OpenSafeScanAppIntent()) {
                Label("Scan", systemImage: "qrcode.viewfinder")
            }
        }
        .displayName("SafeScan")
        .description("Quick access to scan QR codes")
    }
}

extension SafeScanWidgetControl {
    struct Value {
        // Empty for button control
    }

    struct Provider: AppIntentControlValueProvider {
        func previewValue(configuration: SafeScanConfiguration) -> Value {
            SafeScanWidgetControl.Value()
        }

        func currentValue(configuration: SafeScanConfiguration) async throws -> Value {
            return SafeScanWidgetControl.Value()
        }
    }
}

struct SafeScanConfiguration: ControlConfigurationIntent {
    static let title: LocalizedStringResource = "SafeScan Configuration"
}
