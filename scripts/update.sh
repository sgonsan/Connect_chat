#!/bin/bash

git pull

cd client && npm run build && cd .. 

pm2 restart all