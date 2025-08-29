//
//  AppIntent.swift
//  LockScreenWidget
//
//  Created by Justice Gaines on 8/28/25.
//

import WidgetKit
import AppIntents

struct ConfigurationAppIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource { "SafeScan Configuration" }
    static var description: IntentDescription { "Configure your SafeScan widget." }
}

struct OpenSafeScanAppIntent: AppIntent {
    static var title: LocalizedStringResource { "Open SafeScan" }
    static var description: IntentDescription { "Opens SafeScan app to start scanning" }
    
    static var openAppWhenRun: Bool = true
    
    func perform() async throws -> some IntentResult & OpensIntent {
        // Open the main app using the URL scheme
        let url = URL(string: "safescan://")!
        return .result(opensIntent: OpenURLIntent(url))
    }
}
