#!/bin/bash

yarn build

GIT_HASH=$(git rev-parse --short HEAD) ts-node scripts/upload.ts
