import SwiftUI

struct VisualTimerView: View {
  enum Mode: String, CaseIterable {
    case countdown = "Countdown"
    case stopwatch = "Stopwatch"
  }

  @State private var mode: Mode = .countdown
  @State private var minutes: Int = 5
  @State private var seconds: Int = 0
  @State private var remaining: TimeInterval = 0
  @State private var elapsed: TimeInterval = 0
  @State private var isRunning = false
  @State private var timer: Timer?

  var body: some View {
    NavigationStack {
      VStack(spacing: 28) {
        Picker("Mode", selection: $mode) {
          ForEach(Mode.allCases, id: \.self) { m in
            Text(m.rawValue).tag(m)
          }
        }
        .pickerStyle(.segmented)
        .padding(.horizontal)

        if mode == .countdown && !isRunning && remaining <= 0 {
          durationPicker
        }

        Text(displayTime)
          .font(.system(size: 72, weight: .light, design: .rounded))
          .monospacedDigit()
          .foregroundStyle(isRunning ? AppTheme.accent : .white)
          .minimumScaleFactor(0.5)
          .lineLimit(1)
          .padding(.horizontal)

        HStack(spacing: 20) {
          Button(action: reset) {
            Text("Reset")
              .frame(maxWidth: .infinity)
              .padding(.vertical, 14)
          }
          .buttonStyle(.bordered)
          .tint(.white.opacity(0.6))

          Button(action: toggle) {
            Text(isRunning ? "Pause" : "Start")
              .fontWeight(.semibold)
              .frame(maxWidth: .infinity)
              .padding(.vertical, 14)
          }
          .buttonStyle(.borderedProminent)
          .tint(AppTheme.accent)
        }
        .padding(.horizontal, 24)

        Spacer()
      }
      .padding(.top, 24)
      .background(AppTheme.background.ignoresSafeArea())
      .navigationTitle("Visual Timer")
      .navigationBarTitleDisplayMode(.large)
      .onDisappear { stopTimer() }
      .onChange(of: mode) { _, _ in reset() }
    }
  }

  private var durationPicker: some View {
    HStack(spacing: 16) {
      Stepper("Min \(minutes)", value: $minutes, in: 0...120)
      Stepper("Sec \(seconds)", value: $seconds, in: 0...59)
    }
    .padding(.horizontal, 24)
    .foregroundStyle(.white)
  }

  private var displayTime: String {
    let t: TimeInterval
    switch mode {
    case .countdown:
      t = remaining > 0 ? remaining : TimeInterval(minutes * 60 + seconds)
    case .stopwatch:
      t = elapsed
    }
    let m = Int(t) / 60
    let s = Int(t) % 60
    let ms = Int((t.truncatingRemainder(dividingBy: 1)) * 10)
    return String(format: "%02d:%02d.%d", m, s, ms)
  }

  private func toggle() {
    if isRunning {
      stopTimer()
      isRunning = false
    } else {
      if mode == .countdown && remaining <= 0 {
        remaining = TimeInterval(minutes * 60 + seconds)
      }
      isRunning = true
      UIApplication.shared.isIdleTimerDisabled = true
      timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { _ in tick() }
    }
  }

  private func tick() {
    switch mode {
    case .countdown:
      remaining = max(0, remaining - 0.1)
      if remaining <= 0 {
        stopTimer()
        isRunning = false
        UINotificationFeedbackGenerator().notificationOccurred(.success)
      }
    case .stopwatch:
      elapsed += 0.1
    }
  }

  private func reset() {
    stopTimer()
    isRunning = false
    remaining = 0
    elapsed = 0
  }

  private func stopTimer() {
    timer?.invalidate()
    timer = nil
    UIApplication.shared.isIdleTimerDisabled = false
  }
}

#Preview {
  VisualTimerView()
}
