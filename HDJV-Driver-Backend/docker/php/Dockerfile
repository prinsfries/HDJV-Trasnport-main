FROM php:8.4-fpm

# Install system dependencies and PHP extensions commonly used by Laravel
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     git \
     unzip \
     libpng-dev \
     libonig-dev \
     libxml2-dev \
     libzip-dev \
  && docker-php-ext-install \
     pdo_mysql \
     mbstring \
     zip \
     exif \
     pcntl \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /var/www
