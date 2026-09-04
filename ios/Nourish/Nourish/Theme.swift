import SwiftUI
import UIKit

/// Colour, type and shape tokens taken directly from the Nourish web prototype
/// (`:root` custom properties in Nourish_Global_Experience_V28.html).
enum Theme {
    static let bg = Color(hex: 0xF7F4EE)
    static let card = Color(hex: 0xFFFDF9)
    static let ink = Color(hex: 0x252522)
    static let muted = Color(hex: 0x77756F)
    static let sage = Color(hex: 0x70806A)
    static let sage2 = Color(hex: 0xE3E9DF)
    static let sand = Color(hex: 0xEEE5D6)
    static let line = Color(hex: 0xE4DFD5)
    static let accent = Color(hex: 0xC98263)

    /// #f0ece4 — the warm "notice" / tag surface used throughout the prototype.
    static let warmSurface = Color(hex: 0xF0ECE4)
    static let warmSurfaceAlt = Color(hex: 0xF1EEE7)
    static let tagSurface = Color(hex: 0xF5F2EB)
    static let cookDark = Color(hex: 0x1F211E)

    static let shadow = Color(red: 45.0 / 255.0, green: 40.0 / 255.0, blue: 30.0 / 255.0, opacity: 0.065)
}

extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255.0,
            green: Double((hex >> 8) & 0xFF) / 255.0,
            blue: Double(hex & 0xFF) / 255.0,
            opacity: 1.0
        )
    }
}

/// Iowan Old Style ships with iOS, and it is the display face of the prototype.
/// If it is ever unavailable we fall back to the system serif.
enum Serif {
    static func font(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        let name = weight == .regular ? "IowanOldStyle-Roman" : "IowanOldStyle-Bold"
        if UIFont(name: name, size: size) != nil {
            return Font.custom(name, size: size)
        }
        return Font.system(size: size, weight: weight, design: .serif)
    }
}

extension View {
    /// `.eyebrow` — uppercase, letter spaced, 10px.
    func eyebrowStyle() -> some View {
        self.font(.system(size: 10, weight: .heavy))
            .kerning(1.8)
            .textCase(.uppercase)
            .foregroundColor(Theme.muted)
    }

    /// `.sectionLabel`
    func sectionLabelStyle() -> some View {
        self.font(.system(size: 10, weight: .heavy))
            .kerning(1.5)
            .textCase(.uppercase)
            .foregroundColor(Theme.muted)
    }

    /// `.card`
    func cardStyle(padding: CGFloat = 18, radius: CGFloat = 24) -> some View {
        self.padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .stroke(Theme.line, lineWidth: 1)
            )
            .shadow(color: Theme.shadow, radius: 13, x: 0, y: 8)
    }

    func surfaceStyle(_ color: Color, padding: CGFloat = 12, radius: CGFloat = 17) -> some View {
        self.padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(color)
            .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
    }
}

// MARK: - Text styles

struct H1: View {
    var text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text)
            .font(Serif.font(36))
            .foregroundColor(Theme.ink)
            .lineSpacing(1)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct H2: View {
    var text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text)
            .font(Serif.font(28))
            .foregroundColor(Theme.ink)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct H3: View {
    var text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text)
            .font(Serif.font(21))
            .foregroundColor(Theme.ink)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct Para: View {
    var text: String
    var size: CGFloat
    init(_ text: String, size: CGFloat = 14) {
        self.text = text
        self.size = size
    }
    var body: some View {
        Text(text)
            .font(.system(size: size))
            .foregroundColor(Theme.muted)
            .lineSpacing(4)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct Eyebrow: View {
    var text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text).eyebrowStyle().frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct SectionLabel: View {
    var text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text).sectionLabelStyle().frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Buttons

/// `.btn` — solid ink button.
struct PrimaryButton: View {
    var title: String
    var fullWidth: Bool = true
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(.white)
                .padding(.vertical, 13)
                .padding(.horizontal, 16)
                .frame(maxWidth: fullWidth ? .infinity : nil)
                .background(Theme.ink)
                .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

/// `.btn.secondary` — sage tinted button.
struct SecondaryButton: View {
    var title: String
    var fullWidth: Bool = true
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(Color(hex: 0x354032))
                .padding(.vertical, 13)
                .padding(.horizontal, 16)
                .frame(maxWidth: fullWidth ? .infinity : nil)
                .background(Theme.sage2)
                .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

/// `.link`
struct LinkButton: View {
    var title: String
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 11, weight: .heavy))
                .foregroundColor(Theme.sage)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Small surfaces

/// `.notice`
struct NoticeBox: View {
    var title: String?
    var text: String
    init(title: String? = nil, _ text: String) {
        self.title = title
        self.text = text
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let title {
                Text(title).font(.system(size: 11, weight: .bold)).foregroundColor(Color(hex: 0x5F5B54))
            }
            Text(text).font(.system(size: 11)).foregroundColor(Color(hex: 0x5F5B54)).lineSpacing(3)
        }
        .surfaceStyle(Theme.warmSurface)
    }
}

/// `.legalCard`
struct LegalCard: View {
    var title: String
    var text: String
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title).font(.system(size: 10, weight: .bold)).foregroundColor(Color(hex: 0x625E56))
            Text(text).font(.system(size: 10)).foregroundColor(Color(hex: 0x625E56)).lineSpacing(3)
        }
        .surfaceStyle(Theme.warmSurface, padding: 13, radius: 18)
    }
}

/// `.plusGate`
struct PlusGate: View {
    var title: String
    var text: String
    var buttonTitle: String
    var action: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.system(size: 13, weight: .bold)).foregroundColor(Theme.ink)
            Para(text, size: 12)
            PrimaryButton(title: buttonTitle, action: action)
        }
        .padding(15)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.warmSurface)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Theme.line, lineWidth: 1))
    }
}

/// `.mealTag`
struct MealTag: View {
    var text: String
    var body: some View {
        Text(text)
            .font(.system(size: 9))
            .foregroundColor(Color(hex: 0x5C5A53))
            .padding(.vertical, 4)
            .padding(.horizontal, 7)
            .background(Theme.tagSurface)
            .clipShape(Capsule())
            .overlay(Capsule().stroke(Theme.line, lineWidth: 1))
    }
}

/// `.pill`
struct PillTag: View {
    var text: String
    var body: some View {
        Text(text)
            .font(.system(size: 11))
            .foregroundColor(Color(hex: 0x475143))
            .padding(.vertical, 7)
            .padding(.horizontal, 10)
            .background(Theme.sage2)
            .clipShape(Capsule())
    }
}

/// `.premiumTag`
struct PremiumTag: View {
    var body: some View {
        Text("Plus")
            .font(.system(size: 9, weight: .heavy))
            .kerning(0.7)
            .textCase(.uppercase)
            .foregroundColor(.white)
            .padding(.vertical, 5)
            .padding(.horizontal, 8)
            .background(Theme.ink)
            .clipShape(Capsule())
    }
}

/// `.sourceNote`
struct SourceNote: View {
    var text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text)
            .font(.system(size: 10))
            .foregroundColor(Theme.muted)
            .lineSpacing(3)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}
