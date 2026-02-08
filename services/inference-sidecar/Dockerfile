FROM ubuntu:24.04

ARG DEBIAN_FRONTEND=noninteractive

ARG DARKNET_REPO=https://codeberg.org/CCodeRun/darknet.git
ARG DARKNET_REF=master
ARG DARKNET_COMMIT=a3df422adf773c87cc6af1dd0a577e87847ae081

ARG DARKHELP_REPO=https://codeberg.org/CCodeRun/DarkHelp.git
ARG DARKHELP_REF=master
ARG DARKHELP_COMMIT=8bf10619cf10776b30ac157fca80cf0043452b40

RUN apt-get update && apt-get install --no-install-recommends -y \
  build-essential \
  ca-certificates \
  cmake \
  file \
  git \
  libopencv-dev \
  libopenblas64-0 \
  libmagic-dev \
  libprotobuf-dev \
  libopenblas64-openmp-dev \
  pkg-config \
  protobuf-compiler \
  libtclap-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/src

RUN git clone --branch ${DARKNET_REF} ${DARKNET_REPO} darknet
RUN if [ -n "${DARKNET_COMMIT}" ]; then cd /opt/src/darknet && git fetch origin ${DARKNET_COMMIT} && git checkout -B ${DARKNET_REF} ${DARKNET_COMMIT}; fi
RUN cd /opt/src/darknet && cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
RUN cmake --build /opt/src/darknet/build -j4
RUN cmake --build /opt/src/darknet/build --target package
RUN cd /opt/src/darknet/build && dpkg -i darknet-*.deb

RUN git clone --depth 1 --branch ${DARKHELP_REF} ${DARKHELP_REPO} darkhelp
RUN if [ -n "${DARKHELP_COMMIT}" ]; then cd /opt/src/darkhelp && git fetch --depth 1 origin ${DARKHELP_COMMIT} && git checkout ${DARKHELP_COMMIT}; fi
RUN cmake -S /opt/src/darkhelp -B /opt/src/darkhelp/build -DCMAKE_BUILD_TYPE=Release
RUN cmake --build /opt/src/darkhelp/build -j4
RUN cmake --build /opt/src/darkhelp/build --target package
RUN cd /opt/src/darkhelp/build && dpkg -i darkhelp-*.deb

COPY services/inference-sidecar /opt/src/inference-sidecar
RUN mkdir -p /opt/src/inference-sidecar/assets
COPY public/static/placeholder/frames/001.jpg /opt/src/inference-sidecar/assets/mjpeg-placeholder.jpg
COPY public/static/placeholder/frames /opt/src/inference-sidecar/assets/frames
COPY public/static/placeholder/alexeydetections30FPS.json /opt/src/inference-sidecar/assets/alexeydetections30FPS.json
RUN rm -rf /opt/src/inference-sidecar/build
RUN cmake -S /opt/src/inference-sidecar -B /opt/src/inference-sidecar/build -DCMAKE_BUILD_TYPE=Release
RUN cmake --build /opt/src/inference-sidecar/build -j4

ENV SIDECAR_PORT=9080
ENV DARKNET_REF=${DARKNET_REF}
ENV DARKNET_COMMIT=${DARKNET_COMMIT}
ENV DARKHELP_COMMIT=${DARKHELP_COMMIT}

EXPOSE 9080

CMD ["/opt/src/inference-sidecar/build/inference-sidecar"]
