FROM golang:1.23-alpine AS build

WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/timetracker ./cmd

FROM alpine:3.22

RUN addgroup -S timetracker && adduser -S timetracker -G timetracker
WORKDIR /app
COPY --from=build /out/timetracker /app/timetracker

USER timetracker
EXPOSE 8080
CMD ["/app/timetracker"]

