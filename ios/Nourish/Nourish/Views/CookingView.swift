import SwiftUI

/// `startCooking(i)` / `renderCooking()` — chef mode with the running timer.
struct CookingView: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var router: Router
    @Environment(\.dismiss) private var dismiss

    var index: Int

    init(index: Int) { self.index = index }

    @State private var step = 0
    @State private var seconds = 0
    @State private var sizzle = false

    private let ticker = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    private var meal: Meal? {
        store.meals.indices.contains(index) ? store.meals[index] : nil
    }

    var body: some View {
        SheetScaffold {
            if let meal {
                hero(meal)
                coach(meal)
                ForEach(meal.steps.indices, id: \.self) { number in
                    stepCard(number: number, text: meal.steps[number])
                }
                HStack(spacing: 9) {
                    SecondaryButton(title: "Back to meal") { dismiss() }
                    PrimaryButton(title: step < meal.steps.count ? "Next step" : "Finish") {
                        advance(meal)
                    }
                }
                .padding(.top, 6)
            }
        }
        .onAppear {
            seconds = (meal?.duration ?? 0) * 60
            withAnimation(.easeInOut(duration: 1.4).repeatForever(autoreverses: true)) { sizzle = true }
        }
        .onReceive(ticker) { _ in
            if seconds > 0 { seconds -= 1 }
        }
    }

    private func hero(_ meal: Meal) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("COOKING")
                    .font(.system(size: 10, weight: .heavy))
                    .kerning(1.6)
                Spacer()
                Text("\(meal.duration) min · \(meal.name)")
                    .font(.system(size: 10))
                    .lineLimit(1)
            }
            .foregroundColor(.white.opacity(0.7))

            pan

            HStack {
                Text(step < meal.steps.count ? "Step \(step + 1) of \(meal.steps.count)" : "Ready")
                    .font(.system(size: 10, weight: .bold))
                Spacer()
                Text("Chef guidance").font(.system(size: 10))
            }
            .foregroundColor(.white.opacity(0.7))

            Text(formattedTimer)
                .font(Serif.font(44))
                .kerning(-1)
                .foregroundColor(.white)

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.white.opacity(0.18))
                    Capsule()
                        .fill(Theme.sage2)
                        .frame(width: geo.size.width * CGFloat(max(8, progress(meal))) / 100.0)
                }
            }
            .frame(height: 6)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.cookDark)
        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
    }

    /// The prototype's animated pan.
    private var pan: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color(hex: 0x2C2F2A))
                .frame(width: 170, height: 96)
            Ellipse()
                .fill(Theme.accent.opacity(0.85))
                .frame(width: 96, height: 44)
                .scaleEffect(sizzle ? 1.06 : 0.96)
            HStack(spacing: 18) {
                ForEach(0..<3, id: \.self) { i in
                    Circle()
                        .fill(Color.white.opacity(0.25))
                        .frame(width: 6, height: 6)
                        .offset(y: sizzle ? -26 : -12)
                        .opacity(sizzle ? 0.1 : 0.8)
                        .animation(
                            .easeInOut(duration: 1.4).repeatForever(autoreverses: true).delay(Double(i) * 0.25),
                            value: sizzle
                        )
                }
            }
            .offset(y: -34)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 150)
    }

    private func coach(_ meal: Meal) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Chef's cue").font(.system(size: 12, weight: .bold)).foregroundColor(Theme.ink)
            Para(step < meal.steps.count
                 ? NourishData.chefCue(step: step)
                 : "Give it a moment to rest, then serve. You made it.", size: 12)
        }
        .surfaceStyle(Theme.warmSurfaceAlt, padding: 15, radius: 20)
    }

    private func stepCard(number: Int, text: String) -> some View {
        let done = number < step
        let active = number == step
        return HStack(alignment: .top, spacing: 12) {
            Text(done ? "✓" : "\(number + 1)")
                .font(.system(size: 11, weight: .heavy))
                .foregroundColor(Theme.ink)
                .frame(width: 28, height: 28)
                .background(done ? Theme.sage2 : Color(hex: 0xEEEAE2))
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 4) {
                Text(active ? "Now" : (done ? "Done" : "Next"))
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(Theme.ink)
                Para(text, size: 12)
            }
        }
        .padding(15)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(active ? Theme.sage2 : Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(active ? Theme.sage : Theme.line, lineWidth: 1))
        .opacity(done ? 0.62 : 1)
    }

    private var formattedTimer: String {
        String(format: "%02d:%02d", seconds / 60, seconds % 60)
    }

    private func progress(_ meal: Meal) -> Int {
        guard !meal.steps.isEmpty else { return 100 }
        return Int((Double(step) / Double(meal.steps.count) * 100).rounded())
    }

    /// `advanceCook()`
    private func advance(_ meal: Meal) {
        if step < meal.steps.count {
            step += 1
        } else {
            dismiss()
            store.markMealComplete(index)
        }
    }
}
