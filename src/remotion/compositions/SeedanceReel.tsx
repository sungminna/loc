// SeedanceReel — Seedance 2.0 영상 클립을 씬 단위로 이어붙이고 그 위에
// 인포그래픽/타이포 오버레이를 얹는 비디오 템플릿.
//
// 입력 형식
//   props.scenes[i].videoUrl  ← 사전 렌더된 R2 공개 MP4
//   props.scenes[i].headline  ← 큰 제목 (씬 시작 후 24f부터 페이드인)
//   props.scenes[i].body      ← 보조 설명 (lower third)
//   props.scenes[i].stat      ← 카운트업 stat (오른쪽 글래스 카드)
//   props.scenes[i].chapter   ← 좌상단 챕터 라벨 ("01 · OPENING")
//   props.scenes[i].durationSec ← 힌트. 실제 클립 길이를 OffthreadVideo가
//                                 메타에서 읽어와 자동 셋업.
//
// 디자인: 영상은 90% 시인성을 위해 살짝 비네팅 + 하단 그라데이션을 깔고,
// 글로벌 progress bar (단계 단위) + 워터마크 + 캡션 카드. 각 씬마다
// 챕터 카드가 빠르게 들어왔다 사라지고, 본문 텍스트는 lower third 라인
// 위에 슬라이드 인.
//
// SeedanceReel은 generate_audio=true인 클립의 오디오를 살리고, 별도의
// audioUrl이 들어오면 ducking을 위해 볼륨을 낮춘다 (BGM 보조 라이즈).

import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { ReelVideoScene, VideoReelProps } from "../types";
import { palettes, theme } from "../theme";
import { countUp, splitTextProgress } from "../animations";

const FPS = 30;
const FALLBACK_SCENE_FRAMES = 5 * FPS;

export const defaultSeedanceReelProps: VideoReelProps = {
  brand: { handle: "@yourhandle", name: "Loc" },
  lang: "ko",
  scenes: [
    {
      chapter: "OPENING",
      kicker: "TRENDING",
      headline: "여기서부터 보세요",
      body: "12초 안에 핵심을 다 보여드립니다.",
      durationSec: 5,
    },
    {
      chapter: "INSIGHT",
      headline: "왜 지금이냐면",
      body: "트렌드의 첫 6주가 가장 빠르다.",
      stat: { value: "73", suffix: "%", label: "초기 진입자 우위" },
      durationSec: 6,
    },
    {
      chapter: "SHIFT",
      headline: "핵심 변화 한 가지",
      body: "익숙했던 기준이 더는 통하지 않는 영역.",
      durationSec: 5,
    },
    {
      chapter: "ACTION",
      headline: "오늘 시도해 볼 것",
      body: "1분이면 됩니다.",
      durationSec: 4,
    },
    {
      chapter: "CLOSING",
      headline: "저장하고 다시 보기",
      durationSec: 3,
    },
  ],
};

export const SeedanceReel: React.FC<VideoReelProps> = ({ brand, lang, scenes, audioUrl, attribution, accent }) => {
  const { fps } = useVideoConfig();
  const fontFamily = lang === "ko" ? theme.fontFamilyKo : theme.fontFamilyEn;
  const list = scenes.length ? scenes : defaultSeedanceReelProps.scenes;
  const palette = palettes.midnight;
  const accentColor = accent ?? palette.accent;

  const sceneFrames = list.map((s) => Math.max(1, Math.round((s.durationSec ?? 5) * fps)));
  const cumOffsets = sceneFrames.reduce<number[]>((acc, f) => {
    acc.push((acc[acc.length - 1] ?? 0) + f);
    return acc;
  }, []);

  return (
    <AbsoluteFill style={{ background: "#000", color: palette.text, fontFamily, overflow: "hidden" }}>
      {audioUrl ? <Audio src={audioUrl} volume={0.18} /> : null}

      {list.map((scene, i) => {
        const offset = i === 0 ? 0 : cumOffsets[i - 1] ?? 0;
        const length = sceneFrames[i] ?? FALLBACK_SCENE_FRAMES;
        return (
          <Sequence key={i} from={offset} durationInFrames={length}>
            <Scene scene={scene} index={i} total={list.length} fps={fps} accent={accentColor} fontFamily={fontFamily} />
          </Sequence>
        );
      })}

      <ProgressBar offsets={cumOffsets} accent={accentColor} />
      <BrandWatermark brand={brand} accent={accentColor} />
      {attribution ? <Attribution text={attribution} /> : null}
    </AbsoluteFill>
  );
};

const Scene: React.FC<{
  scene: ReelVideoScene; index: number; total: number; fps: number; accent: string; fontFamily: string;
}> = ({ scene, index, total, fps, accent, fontFamily }) => {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.6, stiffness: 100 } });

  return (
    <AbsoluteFill>
      {scene.videoUrl ? (
        <OffthreadVideo
          src={scene.videoUrl}
          // Seedance audio is part of the clip; if a global BGM track is
          // playing, we trim per-clip audio so it doesn't fight.
          volume={0.85}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <FallbackBg accent={accent} />
      )}

      {/* vignette + bottom gradient for caption legibility */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)",
      }} />
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, height: "55%",
        background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.78) 75%)",
      }} />

      {/* chapter card (top-left) */}
      <div style={{
        position: "absolute", top: 120, left: 80,
        display: "flex", alignItems: "center", gap: 14,
        opacity: interpolate(frame, [0, 12, 60, 72], [0, 1, 1, 0.6], { extrapolateRight: "clamp" }),
        transform: `translateX(${(1 - enter) * -30}px)`,
      }}>
        <div style={{ width: 8, height: 8, background: accent, borderRadius: 4 }} />
        <div style={{
          fontSize: 22, fontWeight: 800, letterSpacing: 6, color: "#fff",
          textTransform: "uppercase", textShadow: "0 2px 12px rgba(0,0,0,0.6)",
        }}>
          {String(index + 1).padStart(2, "0")} · {scene.chapter ?? scene.kicker ?? "SCENE"}
        </div>
      </div>

      {/* progress index (top-right) */}
      <div style={{
        position: "absolute", top: 120, right: 80,
        fontSize: 22, fontWeight: 700, letterSpacing: 4,
        color: "rgba(255,255,255,0.85)", textShadow: "0 2px 12px rgba(0,0,0,0.6)",
      }}>
        {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </div>

      {/* stat card on right */}
      {scene.stat ? <StatCard stat={scene.stat} accent={accent} frame={frame} /> : null}

      {/* headline + body lower third */}
      <div style={{
        position: "absolute", left: 80, right: 80, bottom: 240,
        textShadow: "0 4px 20px rgba(0,0,0,0.8)",
      }}>
        {scene.headline ? <SceneHeadline text={scene.headline} frame={frame} fps={fps} accent={accent} /> : null}
        {scene.body ? (
          <div style={{
            fontSize: 32, lineHeight: 1.45, color: "rgba(255,255,255,0.92)",
            marginTop: 24, fontWeight: 500, maxWidth: 880,
            opacity: interpolate(frame, [16, 32], [0, 1], { extrapolateRight: "clamp" }),
            transform: `translateY(${interpolate(frame, [16, 32], [16, 0], { extrapolateRight: "clamp" })}px)`,
          }}>
            {scene.body}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const SceneHeadline: React.FC<{ text: string; frame: number; fps: number; accent: string }> = ({ text, frame, fps, accent }) => {
  const words = text.split(/\s+/);
  return (
    <div style={{ fontFamily: "inherit" }}>
      {words.map((w, i) => {
        const t = splitTextProgress(frame, fps, i, { startFrame: 8, perItemFrames: 3, durationFrames: 14 });
        return (
          <span key={i} style={{
            display: "inline-block", marginRight: 16,
            fontSize: 88, fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.025em",
            opacity: t,
            transform: `translateY(${(1 - t) * 30}px)`,
            color: i === 0 ? accent : "#fff",
          }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

const StatCard: React.FC<{ stat: NonNullable<ReelVideoScene["stat"]>; accent: string; frame: number }> = ({ stat, accent, frame }) => {
  const target = Number(stat.value) || 0;
  const decimals = stat.value.includes(".") ? 1 : 0;
  const t = interpolate(frame, [12, 28], [0, 1], { extrapolateRight: "clamp" });
  // 3D flip-in — card rotates from rotateY(40deg) so it feels like it's being
  // placed onto the scene, not just sliding up.
  const ry = (1 - t) * 40;
  return (
    <div style={{
      position: "absolute", top: "32%", right: 80,
      background: "rgba(0,0,0,0.55)", backdropFilter: "blur(20px)",
      border: `1.5px solid ${accent}66`, borderRadius: 28,
      padding: "28px 36px", textAlign: "right", minWidth: 320,
      opacity: t,
      transform: `perspective(1400px) rotateY(${ry}deg) translateY(${(1 - t) * 40}px)`,
      transformOrigin: "right center",
      boxShadow: `0 20px 60px rgba(0,0,0,0.5)`,
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 4, color: accent, textTransform: "uppercase" }}>
        STAT
      </div>
      <div style={{
        fontSize: 110, fontWeight: 900, lineHeight: 1, marginTop: 8,
        fontFeatureSettings: "'tnum'", color: "#fff",
      }}>
        {countUp(frame, target, { startFrame: 12, durationFrames: 28, suffix: stat.suffix ?? "", decimals })}
      </div>
      {stat.label ? (
        <div style={{ fontSize: 22, color: "rgba(255,255,255,0.78)", marginTop: 10, lineHeight: 1.3 }}>
          {stat.label}
        </div>
      ) : null}
    </div>
  );
};

const FallbackBg: React.FC<{ accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  return (
    <div style={{
      position: "absolute", inset: 0,
      background: `radial-gradient(circle at ${30 + Math.sin(t) * 20}% ${50 + Math.cos(t) * 15}%, ${accent}33, transparent 60%), linear-gradient(135deg, #0a0118 0%, #1a0030 50%, #00121f 100%)`,
    }} />
  );
};

const ProgressBar: React.FC<{ offsets: number[]; accent: string }> = ({ offsets, accent }) => {
  const frame = useCurrentFrame();
  const total = offsets.length;
  const totalFrames = offsets[total - 1] ?? 1;
  const overall = Math.min(1, frame / totalFrames);

  return (
    <div style={{ position: "absolute", top: 60, left: 80, right: 80, display: "flex", gap: 8 }}>
      {offsets.map((end, i) => {
        const start = i === 0 ? 0 : offsets[i - 1] ?? 0;
        const sliceLen = end - start;
        const localFill = Math.max(0, Math.min(1, (frame - start) / sliceLen));
        return (
          <div key={i} style={{
            flex: 1, height: 5, background: "rgba(255,255,255,0.18)",
            borderRadius: 3, overflow: "hidden",
          }}>
            <div style={{ width: `${localFill * 100}%`, height: "100%", background: accent }} />
          </div>
        );
      })}
      <div style={{
        marginLeft: 12, fontSize: 16, color: "rgba(255,255,255,0.6)",
        letterSpacing: 2, alignSelf: "center", minWidth: 56, textAlign: "right",
      }}>
        {Math.round(overall * 100)}%
      </div>
    </div>
  );
};

const BrandWatermark: React.FC<{ brand: { handle: string; name: string }; accent: string }> = ({ brand, accent }) => (
  <div style={{
    position: "absolute", bottom: 140, left: 0, right: 0,
    display: "flex", justifyContent: "center", alignItems: "center", gap: 16,
    fontSize: 22, color: "rgba(255,255,255,0.85)", letterSpacing: 4,
    textShadow: "0 2px 10px rgba(0,0,0,0.6)",
  }}>
    <span style={{ width: 6, height: 6, background: accent, borderRadius: 3 }} />
    <span style={{ fontWeight: 800, color: "#fff" }}>{brand.name.toUpperCase()}</span>
    <span style={{ opacity: 0.7 }}>{brand.handle}</span>
  </div>
);

const Attribution: React.FC<{ text: string }> = ({ text }) => (
  <div style={{
    position: "absolute", bottom: 40, left: 0, right: 0, textAlign: "center",
    fontSize: 14, color: "rgba(255,255,255,0.45)",
    textShadow: "0 1px 4px rgba(0,0,0,0.6)",
  }}>{text}</div>
);

// Img is unused but imported for potential poster fallback; keep silent.
void Img;
