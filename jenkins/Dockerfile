FROM jenkins/jenkins:lts-jdk17

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       curl \
       ca-certificates \
       nodejs \
       npm \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSLo docker.tgz https://download.docker.com/linux/static/stable/x86_64/docker-27.3.1.tgz \
    && tar -xzf docker.tgz -C /usr/local/bin --strip-components=1 docker/docker \
    && rm docker.tgz

RUN KUBECTL_VERSION=$(curl -L -s https://dl.k8s.io/release/stable.txt) \
    && curl -Lo /usr/local/bin/kubectl "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl" \
    && chmod +x /usr/local/bin/kubectl

COPY plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt

ENV KUBECONFIG=/kubeconfig/config

# Lab setup: the controller is used as a build agent
# and needs access to the Docker daemon and kubectl.
USER root
