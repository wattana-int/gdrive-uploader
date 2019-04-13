FROM node:10.15.3-stretch-slim

ENV PATH $PATH:/node_modules/.bin:/app/
RUN npm install -g npm@6.9.0
COPY package.json package-lock.json /
RUN npm install

COPY . /app
WORKDIR /app