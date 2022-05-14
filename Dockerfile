# syntax=docker/dockerfile:1

FROM node:lts-slim

ENV NODE_ENV="production"

WORKDIR /usr/src/shy

COPY . .


RUN apt-get update -y && apt-get wget curl install python ffmpeg -y
RUN bash dl.sh
RUN npm install


CMD ["npm", "start"]