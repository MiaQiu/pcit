FROM public.ecr.aws/lambda/python:3.10

# git for USC model code, tar/xz for static ffmpeg
RUN yum install -y git tar xz && yum clean all

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

# Clone USC SAIL diarization repo — we only need the whisper-modeling subdir
RUN git clone --depth=1 https://github.com/usc-sail/child-adult-diarization.git /tmp/usc \
    && cp -r /tmp/usc/whisper-modeling/models  ${LAMBDA_TASK_ROOT}/models \
    && cp -r /tmp/usc/whisper-modeling/scripts ${LAMBDA_TASK_ROOT}/scripts \
    && rm -rf /tmp/usc \
    && touch ${LAMBDA_TASK_ROOT}/models/__init__.py \
             ${LAMBDA_TASK_ROOT}/scripts/__init__.py

# Remove .cuda() calls — Lambda has no GPU
RUN sed -i \
    's/= features\.input_features\.cuda()/= features.input_features/g' \
    ${LAMBDA_TASK_ROOT}/models/whisper.py

# Python deps (no training libs — inference only)
COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt

# Download model weights at build time so cold starts are fast
RUN python3 -c "\
from huggingface_hub import hf_hub_download; \
import os; \
hf_hub_download( \
    repo_id='AlexXu811/whisper-child-adult', \
    filename='whisper-base_rank8_pretrained_50k.pt', \
    local_dir=os.environ['LAMBDA_TASK_ROOT'] \
)"

COPY handler.py classifier.py ${LAMBDA_TASK_ROOT}/

CMD ["handler.lambda_handler"]
