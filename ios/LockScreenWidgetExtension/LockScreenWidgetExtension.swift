//
//  LockScreenWidget.swift
//  LockScreenWidget
//
//  Created by Justice Gaines on 8/28/25.
//

import WidgetKit
import SwiftUI

struct Provider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), configuration: ConfigurationAppIntent())
    }

    func snapshot(for configuration: ConfigurationAppIntent, in context: Context) async -> SimpleEntry {
        SimpleEntry(date: Date(), configuration: configuration)
    }
    
    func timeline(for configuration: ConfigurationAppIntent, in context: Context) async -> Timeline<SimpleEntry> {
        var entries: [SimpleEntry] = []

        // Generate a timeline consisting of five entries an hour apart, starting from the current date.
        let currentDate = Date()
        for hourOffset in 0 ..< 5 {
            let entryDate = Calendar.current.date(byAdding: .hour, value: hourOffset, to: currentDate)!
            let entry = SimpleEntry(date: entryDate, configuration: configuration)
            entries.append(entry)
        }

        return Timeline(entries: entries, policy: .atEnd)
    }

//    func relevances() async -> WidgetRelevances<ConfigurationAppIntent> {
//        // Generate a list containing the contexts this widget is relevant in.
//    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let configuration: ConfigurationAppIntent
}

struct LockScreenWidgetEntryView : View {
    var entry: Provider.Entry

    var body: some View {
        Link(destination: URL(string: "safescan://")!) {
            HStack(spacing: 8) {
                Image("WidgetLogo")
                    .resizable()
                    .frame(width: 36, height: 36)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("SafeScan")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.primary)
                }
                
                Spacer()
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.horizontal, 4)
            .padding(.vertical, 6)
        }
    }
}



struct LockScreenWidget: Widget {
    let kind: String = "LockScreenWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: ConfigurationAppIntent.self, provider: Provider()) { entry in
            LockScreenWidgetEntryView(entry: entry)
                .containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName("SafeScan Lock Screen Widget")
        .description("Quick access to scan from lock screen")
        .supportedFamilies([.accessoryRectangular])
    }
}


extension ConfigurationAppIntent {
    fileprivate static var defaultConfig: ConfigurationAppIntent {
        let intent = ConfigurationAppIntent()
        return intent
    }
}

#Preview("SafeScan Lock Screen Widget", as: .accessoryRectangular) {
    LockScreenWidget()
} timeline: {
    SimpleEntry(date: .now, configuration: .defaultConfig)
}
