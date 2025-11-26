FROM node:12-buster
WORKDIR /screeps

RUN sed -i -e 's|deb.debian.org|archive.debian.org|g' \
  -e 's|security.debian.org|archive.debian.org|g' /etc/apt/sources.list \
  && printf 'Acquire::Check-Valid-Until "0";\n' > /etc/apt/apt.conf.d/99archive \
  && apt-get update && apt-get install -y \
  curl git build-essential make gcc automake autoconf libtool \
  python \
  && rm -rf /var/lib/apt/lists/*

COPY ./package.json /screeps/package.json

RUN yarn install

CMD [ "yarn", "screeps", "start" ]
