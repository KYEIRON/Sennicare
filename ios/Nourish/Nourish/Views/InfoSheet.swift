import SwiftUI

/// The prototype's informational sheets: a heading, some cards and a closing
/// button. Kept word for word.
struct InfoSheet: View {
    @Environment(\.dismiss) private var dismiss

    var eyebrow: String
    var title: String
    var intro: String
    var cards: [Card]
    var notice: (title: String, text: String)?
    var legal: (title: String, text: String)?
    var safety: String?
    var button: String

    struct Card: Identifiable {
        var id = UUID()
        var label: String? = nil
        var heading: String? = nil
        var lines: [String]
    }

    var body: some View {
        SheetScaffold {
            Eyebrow(eyebrow)
            H2(title)
            Para(intro)

            if let notice {
                NoticeBox(title: notice.title, notice.text)
            }

            ForEach(cards) { card in
                VStack(alignment: .leading, spacing: 6) {
                    if let label = card.label {
                        Text(label)
                            .font(.system(size: 9, weight: .heavy))
                            .kerning(1)
                            .textCase(.uppercase)
                            .foregroundColor(Theme.sage)
                    }
                    if let heading = card.heading {
                        H3(heading)
                    }
                    ForEach(card.lines, id: \.self) { line in
                        Para(line, size: 12)
                    }
                }
                .cardStyle()
            }

            if let safety {
                VStack(alignment: .leading, spacing: 6) {
                    Eyebrow("Evidence based · Nuance matters")
                    Para(safety, size: 12)
                }
                .cardStyle()
            }

            if let legal {
                LegalCard(title: legal.title, text: legal.text)
            }

            PrimaryButton(title: button) { dismiss() }
        }
    }
}

extension InfoSheet {
    /// `openSheet('recovery')`
    static var recovery: InfoSheet {
        InfoSheet(
            eyebrow: "Recovery",
            title: "Find your rhythm again.",
            intro: "Simple food, movement and rest ideas that can fit around real life.",
            cards: [
                Card(
                    heading: "Start small",
                    lines: ["Choose an easy meal, drink enough fluids for your needs, and take a gentle walk or stretch if it feels comfortable."]
                )
            ],
            notice: nil,
            legal: nil,
            safety: nil,
            button: "Done"
        )
    }

    /// `openSheet('discovery')`
    static var discovery: InfoSheet {
        InfoSheet(
            eyebrow: "Nourish Discovery · Food & sleep",
            title: "Eating immediately before bed?",
            intro: "A large meal immediately before sleep can interfere with sleep for some people. It is not a universal rule, and individual responses differ.",
            cards: [],
            notice: (
                "A practical idea",
                "If you notice late meals affect your sleep, try giving yourself some time between dinner and bed and see what works for you."
            ),
            legal: nil,
            safety: "Nourish presents health information to help you explore your choices. It does not diagnose or treat medical conditions.",
            button: "Got it"
        )
    }

    /// `openSheet('aiSleep')`
    static var aiSleep: InfoSheet {
        InfoSheet(
            eyebrow: "AI beta · Sleep",
            title: "Could this meal affect my sleep?",
            intro: "Some people notice that meal size, timing, alcohol, caffeine or particular foods change how they sleep. Research does not mean the same effect will happen to everyone.",
            cards: [
                Card(
                    label: "How Nourish approaches it",
                    lines: ["We can explain what evidence suggests, what remains uncertain, and what you might observe in your own routine. We should not tell you that a food will cause or cure a sleep problem."]
                )
            ],
            notice: nil,
            legal: (
                "Important:",
                "AI beta is general information, not medical advice or a diagnosis. If sleep problems are persistent, severe or worrying, speak with a qualified healthcare professional."
            ),
            safety: nil,
            button: "I understand"
        )
    }

    /// `openSheet('aiEnergy')`
    static var aiEnergy: InfoSheet {
        InfoSheet(
            eyebrow: "AI beta · Everyday patterns",
            title: "Understand your own signals.",
            intro: "Food, sleep, activity, hydration and many other factors can affect how you feel. AI beta can help you organise observations and compare meals without claiming a medical cause.",
            cards: [
                Card(
                    heading: "Try asking",
                    lines: [
                        "\u{201C}What changed between these two meals?\u{201D}",
                        "\u{201C}Which one has more protein or fibre?\u{201D}",
                        "\u{201C}What ingredients are different?\u{201D}"
                    ]
                )
            ],
            notice: nil,
            legal: (
                "No diagnosis.",
                "Nourish should never infer a medical condition from a meal, symptom or pattern."
            ),
            safety: nil,
            button: "Explore safely"
        )
    }

    /// `openSheet('aiDecide')`
    static var aiDecide: InfoSheet {
        InfoSheet(
            eyebrow: "AI beta · Decisions",
            title: "Help me choose.",
            intro: "AI can compare practical factors such as ingredients, estimated nutrition, cooking time, pantry coverage and your stated preferences.",
            cards: [
                Card(
                    lines: [
                        "It can say: \u{201C}Meal A has more fibre and uses five ingredients already in your pantry.\u{201D}",
                        "It should not say: \u{201C}Meal A is the treatment you need.\u{201D}"
                    ]
                )
            ],
            notice: nil,
            legal: (
                "Your choice stays yours.",
                "Personalised food information is not a substitute for professional dietary or medical advice."
            ),
            safety: nil,
            button: "Got it"
        )
    }

    /// `openSheet('aiBeta')`
    static var aiBeta: InfoSheet {
        InfoSheet(
            eyebrow: "Nourish AI beta",
            title: "Intelligence that knows its limits.",
            intro: "AI beta is designed as an explanation and decision support layer across Food, Pantry, Plan and Wellbeing.",
            cards: [
                Card(
                    heading: "What it can help with",
                    lines: ["Compare meals, explain nutrients in plain language, surface food and culture context, find pantry matches, organise shopping and explore everyday patterns such as sleep timing."]
                ),
                Card(
                    heading: "What it will not do",
                    lines: ["Diagnose disease, prescribe treatment, tell someone to stop medication, make emergency decisions, or claim that a food will prevent or cure illness."]
                )
            ],
            notice: nil,
            legal: (
                "Beta notice:",
                "AI generated explanations can be incomplete or wrong. Always check important nutrition, allergy and health information against reliable sources and professional advice where appropriate."
            ),
            safety: nil,
            button: "I understand"
        )
    }
}
