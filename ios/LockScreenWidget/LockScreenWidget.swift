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
        // Lock screen rectangular widget only
        Link(destination: URL(string: "safescan://")!) {
            HStack(spacing: 8) {
                // SafeScan logo area
                ZStack {
                    RoundedRectangle(cornerRadius: 6)
                        .fill(.blue.gradient)
                        .frame(width: 28, height: 28)
                    
                    // Use system icon for now to prevent crashes
                    Image(systemName: "qrcode.viewfinder")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.white)
                }
                
                VStack(alignment: .leading, spacing: 1) {
                    HStack {
                        Text("SafeScan")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.primary)
                        Spacer()
                    }
                }
                
                Spacer()
            }
            .padding(.horizontal, 4)
            .padding(.vertical, 2)
        }
    }
}


struct LockScreenMediumWidgetEntryView : View {
    var entry: Provider.Entry

    var body: some View {
        Link(destination: URL(string: "safescan://")!) {
            HStack(spacing: 8) {
                ZStack {
//                    RoundedRectangle(cornerRadius: 10)
//                        .fill(.blue.gradient)
//                        .frame(width: 40, height: 40)
                    
                    Image(systemName: "qrcode.viewfinder")
                        .font(.system(size: 40, weight: .semibold))
                        .foregroundColor(.white)
                }
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("SafeScan")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.primary)
//                    Text("Quick scan")
//                        .font(.system(size: 12, weight: .medium))
//                        .foregroundColor(.secondary)
                }
                
                Spacer()
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.horizontal, 15)
            .padding(.vertical, 4)
        }
    }
}



struct LockScreenWidget: Widget {
    let kind: String = "LockScreenWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: ConfigurationAppIntent.self, provider: Provider()) { entry in
            LockScreenMediumWidgetEntryView(entry: entry)
                .containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName("SafeScan Lock Screen Widget")
        .description("Quick access to scan from lock screen")
        .supportedFamilies([.accessoryRectangular])
    }
}


extension ConfigurationAppIntent {
    fileprivate static var smiley: ConfigurationAppIntent {
        let intent = ConfigurationAppIntent()
        intent.favoriteEmoji = "😀"
        return intent
    }
    
    fileprivate static var starEyes: ConfigurationAppIntent {
        let intent = ConfigurationAppIntent()
        intent.favoriteEmoji = "🤩"
        return intent
    }
}

#Preview("SafeScan Lock Screen Widget", as: .accessoryRectangular) {
    LockScreenWidget()
} timeline: {
    SimpleEntry(date: .now, configuration: .smiley)
}
