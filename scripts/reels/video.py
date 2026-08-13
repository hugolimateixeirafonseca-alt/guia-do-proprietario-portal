from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path


WIDTH = 1080
HEIGHT = 1920
FPS = 30
TRANSITION = 0.65
INTRO_SECONDS = 6.5
STEP_SECONDS = 2.2
WARNING_SECONDS = 7.5
OUTRO_SECONDS = 7.0
AUDIO_VOLUME = 0.04
AUDIO_FADE_IN = 1.2
AUDIO_FADE_OUT = 1.8


def require_binary(name_or_path: str) -> str:
    candidate = shutil.which(name_or_path)
    if candidate:
        return candidate
    path = Path(name_or_path)
    if path.is_file():
        return str(path)
    raise FileNotFoundError(f"Não foi encontrado o executável obrigatório: {name_or_path}")


def run(command: list[str], label: str) -> None:
    result = subprocess.run(command, text=True, capture_output=True)
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip()
        raise RuntimeError(f"{label} falhou.\n{detail}")


def _still_clip(ffmpeg: str, image: Path, output: Path, seconds: float, zoom: bool = False) -> None:
    frames = round(seconds * FPS)
    command = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-framerate", str(FPS), "-i", str(image)]
    if zoom:
        increment = 0.025 / max(1, frames - 1)
        video_filter = f"zoompan=z='min(zoom+{increment:.9f},1.025)':d={frames}:s={WIDTH}x{HEIGHT}:fps={FPS},format=yuv420p"
    else:
        video_filter = "format=yuv420p"
    command += ["-vf", video_filter, "-frames:v", str(frames), "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", str(output)]
    run(command, f"Criação de {output.name}")


def _steps_clip(ffmpeg: str, images: list[Path], output: Path) -> None:
    command = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y"]
    for image in images:
        command += ["-loop", "1", "-framerate", str(FPS), "-t", str(STEP_SECONDS), "-i", str(image)]
    inputs = "".join(f"[{index}:v]" for index in range(len(images)))
    command += [
        "-filter_complex",
        f"{inputs}concat=n={len(images)}:v=1:a=0,format=yuv420p[v]",
        "-map",
        "[v]",
        "-frames:v",
        str(round(len(images) * STEP_SECONDS * FPS)),
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
        str(output),
    ]
    run(command, "Criação da cena progressiva")


def _mux_background_audio(ffmpeg: str, video: Path, audio: Path, output: Path, duration: float) -> None:
    fade_out_start = max(0.0, duration - AUDIO_FADE_OUT)
    audio_filter = (
        f"volume={AUDIO_VOLUME},"
        f"aresample=async=1:first_pts=0,"
        f"apad=whole_dur={duration:.6f},"
        f"atrim=duration={duration:.6f},"
        f"afade=t=in:st=0:d={AUDIO_FADE_IN},"
        f"afade=t=out:st={fade_out_start:.6f}:d={AUDIO_FADE_OUT},"
        f"asetpts=N/SR/TB[a]"
    )
    run(
        [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(video),
            "-stream_loop",
            "-1",
            "-i",
            str(audio),
            "-filter_complex",
            audio_filter,
            "-map",
            "0:v:0",
            "-map",
            "[a]",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "160k",
            "-t",
            f"{duration:.6f}",
            "-movflags",
            "+faststart",
            str(output),
        ],
        "Adição da faixa de fundo",
    )


def encode_video(ffmpeg_value: str, ffprobe_value: str, frames: dict[str, object], output: Path, work: Path, audio: Path | None = None) -> bool:
    ffmpeg = require_binary(ffmpeg_value)
    intro_clip = work / "intro.mp4"
    steps_clip = work / "steps.mp4"
    warning_clip = work / "warning.mp4"
    outro_clip = work / "outro.mp4"
    _still_clip(ffmpeg, frames["intro"], intro_clip, INTRO_SECONDS, zoom=True)
    _steps_clip(ffmpeg, frames["steps"], steps_clip)
    _still_clip(ffmpeg, frames["warning"], warning_clip, WARNING_SECONDS)
    _still_clip(ffmpeg, frames["outro"], outro_clip, OUTRO_SECONDS)

    steps_seconds = len(frames["steps"]) * STEP_SECONDS
    first_offset = INTRO_SECONDS - TRANSITION
    second_offset = INTRO_SECONDS + steps_seconds - 2 * TRANSITION
    third_offset = INTRO_SECONDS + steps_seconds + WARNING_SECONDS - 3 * TRANSITION
    graph = (
        f"[0:v][1:v]xfade=transition=fade:duration={TRANSITION}:offset={first_offset}[v1];"
        f"[v1][2:v]xfade=transition=fade:duration={TRANSITION}:offset={second_offset}[v2];"
        f"[v2][3:v]xfade=transition=fade:duration={TRANSITION}:offset={third_offset},format=yuv420p[v]"
    )
    command = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y"]
    for clip in (intro_clip, steps_clip, warning_clip, outro_clip):
        command += ["-i", str(clip)]
    video_only = work / "video-only.mp4" if audio and audio.is_file() else output
    command += [
        "-filter_complex",
        graph,
        "-map",
        "[v]",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-r",
        str(FPS),
        "-movflags",
        "+faststart",
        str(video_only),
    ]
    run(command, "Codificação final do MP4")
    audio_added = bool(audio and audio.is_file())
    if audio_added:
        visual_probe = _read_probe(ffprobe_value, video_only)
        duration = float(visual_probe.get("format", {}).get("duration", 0))
        if duration <= 0:
            raise RuntimeError("Não foi possível determinar a duração do vídeo antes de adicionar áudio.")
        _mux_background_audio(ffmpeg, video_only, audio, output, duration)
    if not output.is_file() or output.stat().st_size == 0:
        raise RuntimeError(f"O MP4 não foi gerado: {output}")
    return audio_added


def _read_probe(ffprobe_value: str, output: Path) -> dict:
    ffprobe = require_binary(ffprobe_value)
    result = subprocess.run(
        [ffprobe, "-v", "error", "-show_streams", "-show_format", "-of", "json", str(output)],
        text=True,
        capture_output=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe falhou.\n{result.stderr.strip()}")
    return json.loads(result.stdout)


def probe_video(ffprobe_value: str, output: Path, expected_audio: bool = False) -> dict:
    probe = _read_probe(ffprobe_value, output)
    video_streams = [stream for stream in probe.get("streams", []) if stream.get("codec_type") == "video"]
    audio_streams = [stream for stream in probe.get("streams", []) if stream.get("codec_type") == "audio"]
    if len(video_streams) != 1:
        raise RuntimeError("O MP4 tem de conter exatamente uma pista de vídeo.")
    stream = video_streams[0]
    duration = float(probe.get("format", {}).get("duration", 0))
    errors = []
    if (stream.get("width"), stream.get("height")) != (WIDTH, HEIGHT):
        errors.append(f"resolução {stream.get('width')}x{stream.get('height')}")
    if stream.get("codec_name") != "h264":
        errors.append(f"codec {stream.get('codec_name')}")
    if stream.get("pix_fmt") != "yuv420p":
        errors.append(f"pixel format {stream.get('pix_fmt')}")
    if stream.get("avg_frame_rate") != f"{FPS}/1":
        errors.append(f"fps {stream.get('avg_frame_rate')}")
    if expected_audio and len(audio_streams) != 1:
        errors.append(f"eram esperadas 1 pista de áudio e foram encontradas {len(audio_streams)}")
    if not expected_audio and audio_streams:
        errors.append("foi encontrada uma pista de áudio sem background.mp3")
    if audio_streams and audio_streams[0].get("codec_name") != "aac":
        errors.append(f"codec de áudio {audio_streams[0].get('codec_name')}")
    audio_duration = float(audio_streams[0].get("duration", duration)) if audio_streams else None
    if audio_duration is not None and abs(audio_duration - duration) > 0.05:
        errors.append(f"duração do áudio {audio_duration:.3f}s difere do vídeo {duration:.3f}s")
    if not 25 <= duration <= 32:
        errors.append(f"duração {duration:.3f}s")
    if errors:
        raise RuntimeError("O MP4 falhou a validação: " + ", ".join(errors))
    return {
        "codec": stream["codec_name"],
        "resolution": f"{stream['width']}x{stream['height']}",
        "fps": stream["avg_frame_rate"],
        "duration": duration,
        "pixel_format": stream["pix_fmt"],
        "audio_streams": len(audio_streams),
        "audio_codec": audio_streams[0].get("codec_name") if audio_streams else None,
        "audio_duration": audio_duration,
    }
