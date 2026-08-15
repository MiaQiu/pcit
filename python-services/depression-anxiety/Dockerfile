FROM public.ecr.aws/lambda/python:3.10

# tar/xz for static ffmpeg, libsndfile for soundfile/torchaudio
RUN yum install -y tar xz libsndfile && yum clean all

# Static ffmpeg binary — required to decode m4a/aac from mobile recordings
# detect arch so the same Dockerfile works locally (arm64) and in Lambda (amd64)
RUN ARCH=$(uname -m) \
    && case "$ARCH" in \
         aarch64) FFMPEG_ARCH=arm64 ;; \
         *)        FFMPEG_ARCH=amd64 ;; \
       esac \
    && curl -fsSL -o /tmp/ffmpeg.tar.xz \
       "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-${FFMPEG_ARCH}-static.tar.xz" \
    && mkdir /tmp/ffx \
    && tar xJ -f /tmp/ffmpeg.tar.xz --strip-components=1 -C /tmp/ffx \
    && mv /tmp/ffx/ffmpeg /usr/local/bin/ffmpeg \
    && chmod +x /usr/local/bin/ffmpeg \
    && rm -rf /tmp/ffx /tmp/ffmpeg.tar.xz

# Python deps (no training libs — inference only)
COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir --timeout 600 --retries 5 -r ${LAMBDA_TASK_ROOT}/requirements.txt

# Pull DAM model code + checkpoint from the HuggingFace repo at build time
RUN python3 -c "\
from huggingface_hub import snapshot_download; \
import os; \
snapshot_download( \
    repo_id='KintsugiHealth/dam', \
    local_dir=os.environ['LAMBDA_TASK_ROOT'], \
    allow_patterns=['pipeline.py', 'model.py', 'config.py', 'featex.py', 'dam3.1.ckpt'] \
)"

# Bake in the Whisper-small.en backbone weights so the Lambda runtime never
# needs network access or a writable HF cache dir (/var/task is read-only)
ENV HF_HOME=${LAMBDA_TASK_ROOT}/hf_cache
RUN python3 -c "\
from huggingface_hub import snapshot_download; \
snapshot_download(repo_id='openai/whisper-small.en')"
ENV HF_HUB_OFFLINE=1

COPY handler.py classifier.py ${LAMBDA_TASK_ROOT}/

CMD ["handler.lambda_handler"]
