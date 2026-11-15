#!/usr/bin/env python3
"""Fetch 60 HeyGen clips and physically apply the 6 user-approved end trims.
Run from repository root: python scripts/import_selfstudy_audio.py
Requires Python 3, ffmpeg and ffprobe, and access to the HeyGen URLs.
Does NOT change the original speech or update index.html automatically.
"""
from pathlib import Path
import json, subprocess, urllib.request, urllib.error
ROOT=Path(__file__).resolve().parent.parent
CONF=json.loads((ROOT/"selfstudy-audio-manifest.json").read_text(encoding="utf-8"))
DEST=ROOT/"selfstudy-assets"/"audio"
RAW=ROOT/"selfstudy-assets"/"originals"

def command(args):
    result=subprocess.run(args,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if result.returncode: raise RuntimeError(result.stderr[-1000:])
    return result.stdout.strip()
def duration(path):
    return float(command(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",str(path)]))
def download(url,path):
    if path.exists() and path.stat().st_size>1000: return
    request=urllib.request.Request(url,headers={"User-Agent":"TOPA-audio-import/1.0"})
    with urllib.request.urlopen(request,timeout=45) as res:
        content=res.read()
    if len(content)<1000:
        raise RuntimeError("Unexpectedly short audio content for "+path.name)
    path.write_bytes(content)
def items():
    women=set(CONF["storyWomanIndices"])
    for language, group in CONF["languages"].items():
        prefix=group["prefix"]
        for index, asset in enumerate(group["story"]):
            role="woman" if index in women else "learner"
            file=f"{prefix}_story_{index:02d}.mp3"
            yield language,index,role,asset,file
        yield language,None,"narrator",group["order"],prefix+"_order.mp3"
        yield language,None,"narrator",group["choice"],prefix+"_choice.mp3"
def main():
    DEST.mkdir(parents=True,exist_ok=True)
    RAW.mkdir(parents=True,exist_ok=True)
    report=[]
    for language,index,role,asset,file in items():
        url=CONF["sourceBase"]+CONF["voices"][role]+"/id="+asset+".mp3"
        source=RAW/file
        output=DEST/file
        download(url,source)
        trim=CONF["approvedTailTrimSeconds"].get(f"{language}::{index}",0) if index is not None else 0
        if trim:
            full=duration(source)
            target=full-trim
            if target<=0.4: raise RuntimeError("Trim too large for "+file)
            fade=min(.025,target/8)
            command(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",str(source),
                     "-t",f"{target:.4f}","-af",f"afade=t=out:st={target-fade:.4f}:d={fade:.4f}",
                     "-c:a","libmp3lame","-b:a","160k",str(output)])
        else:
            output.write_bytes(source.read_bytes())
        report.append({"language":language,"story_index":index,"voice":role,"file":file,"trimmed_seconds":trim,
                       "size":output.stat().st_size})
        print("Saved:",file, "(cut "+str(trim)+" s)" if trim else "")
    (DEST/"import_report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print("Created",len(report),"MP3 files in",DEST)
    print("Next: set TopaSelfStudyAudio.setUseLocal(true) / change default useLocal in selfstudy-audio.js.")
if __name__=="__main__": main()
