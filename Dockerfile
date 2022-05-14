# syntax=docker/dockerfile:1

FROM node:lts

ENV NODE_ENV="production"

WORKDIR /usr/src/shy

COPY . .

RUN bash dl.sh
RUN apt-get update -y && apt-get install python ffmpeg -y
RUN npm install

CMD ["npm", "start"]