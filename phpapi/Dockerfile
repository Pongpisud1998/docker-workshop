FROM php:8.2-apache

# Install Postgre PDO & SQLite
RUN apt-get update && apt-get install -y libpq-dev libsqlite3-dev \
    && docker-php-ext-install pdo pdo_pgsql pdo_sqlite

# Enable Apache mod_rewrite
RUN a2enmod rewrite

# Copy source code
COPY src/ /var/www/html/
