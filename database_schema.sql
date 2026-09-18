CREATE DATABASE IF NOT EXISTS rkveda_tiffin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rkveda_tiffin;

CREATE TABLE IF NOT EXISTS admins (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(100) NOT NULL,
 mobile VARCHAR(20) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 role ENUM('super_admin','admin') DEFAULT 'admin',
 active TINYINT(1) DEFAULT 1,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(120) NOT NULL,
 mobile VARCHAR(20) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 email VARCHAR(160),
 active TINYINT(1) DEFAULT 1,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS addresses (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 customer_id BIGINT UNSIGNED NOT NULL,
 label VARCHAR(50) DEFAULT 'Home',
 address_line1 VARCHAR(255) NOT NULL,
 address_line2 VARCHAR(255),
 area VARCHAR(120),
 city VARCHAR(100) NOT NULL DEFAULT 'Dehradun',
 state VARCHAR(100) NOT NULL DEFAULT 'Uttarakhand',
 pincode VARCHAR(10) NOT NULL,
 landmark VARCHAR(160),
 is_default TINYINT(1) DEFAULT 0,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS menu_days (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 day_of_week TINYINT NOT NULL UNIQUE,
 day_name VARCHAR(20) NOT NULL,
 lunch_dal VARCHAR(120) NOT NULL,
 lunch_dry_sabzi VARCHAR(120) NOT NULL,
 lunch_rice VARCHAR(120) NOT NULL,
 lunch_salad VARCHAR(120) NOT NULL,
 lunch_raita VARCHAR(120) NOT NULL,
 lunch_image_url VARCHAR(500),
 dinner_dal VARCHAR(120) NOT NULL,
 dinner_dry_sabzi VARCHAR(120) NOT NULL,
 dinner_rice VARCHAR(120) NOT NULL,
 dinner_salad VARCHAR(120) NOT NULL,
 dinner_raita VARCHAR(120) NOT NULL,
 dinner_image_url VARCHAR(500),
 active TINYINT(1) DEFAULT 1,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plans (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(100) NOT NULL,
 duration_days INT NOT NULL,
 meal_type ENUM('lunch','dinner','both') NOT NULL,
 price DECIMAL(10,2) NOT NULL,
 description VARCHAR(500),
 active TINYINT(1) DEFAULT 1,
 sort_order INT DEFAULT 0,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 order_number VARCHAR(40) NOT NULL UNIQUE,
 customer_id BIGINT UNSIGNED NOT NULL,
 address_id BIGINT UNSIGNED NOT NULL,
 plan_id BIGINT UNSIGNED,
 order_type ENUM('one_time','subscription') DEFAULT 'one_time',
 meal_type ENUM('lunch','dinner','both') NOT NULL,
 quantity INT DEFAULT 1,
 service_date DATE,
 start_date DATE,
 end_date DATE,
 subtotal DECIMAL(10,2) NOT NULL,
 delivery_charge DECIMAL(10,2) DEFAULT 0,
 total_amount DECIMAL(10,2) NOT NULL,
 payment_status ENUM('pending','paid','failed','refunded') DEFAULT 'pending',
 order_status ENUM('pending','confirmed','preparing','out_for_delivery','delivered','cancelled') DEFAULT 'pending',
 notes VARCHAR(500),
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY (customer_id) REFERENCES customers(id),
 FOREIGN KEY (address_id) REFERENCES addresses(id),
 FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payments (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 order_id BIGINT UNSIGNED NOT NULL,
 customer_id BIGINT UNSIGNED NOT NULL,
 gateway VARCHAR(40) DEFAULT 'razorpay',
 gateway_order_id VARCHAR(255),
 gateway_payment_id VARCHAR(255),
 signature VARCHAR(500),
 amount DECIMAL(10,2) NOT NULL,
 currency VARCHAR(10) DEFAULT 'INR',
 method VARCHAR(50),
 status ENUM('created','authorized','captured','failed','refunded') DEFAULT 'created',
 raw_response JSON,
 paid_at DATETIME,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_gateway_payment (gateway_payment_id),
 FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
 FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subscriptions (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 subscription_number VARCHAR(40) NOT NULL UNIQUE,
 customer_id BIGINT UNSIGNED NOT NULL,
 plan_id BIGINT UNSIGNED NOT NULL,
 order_id BIGINT UNSIGNED,
 start_date DATE NOT NULL,
 end_date DATE NOT NULL,
 status ENUM('pending','active','paused','expired','cancelled') DEFAULT 'pending',
 meals_remaining INT DEFAULT 0,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
 FOREIGN KEY (plan_id) REFERENCES plans(id),
 FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS settings (
 setting_key VARCHAR(100) PRIMARY KEY,
 setting_value TEXT,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO menu_days
(day_of_week,day_name,lunch_dal,lunch_dry_sabzi,lunch_rice,lunch_salad,lunch_raita,
dinner_dal,dinner_dry_sabzi,dinner_rice,dinner_salad,dinner_raita)
VALUES
(1,'Monday','Dal Tadka','Aloo Gobhi','Jeera Rice','Cucumber + Onion','Boondi Raita','Dal Fry','Mix Veg','Steamed Rice','Cucumber + Onion','Boondi Raita'),
(2,'Tuesday','Rajma Masala','Aloo Tamatar','Steamed Rice','Onion + Cucumber','Plain Raita','Chana Masala','Lauki Chana Dal','Jeera Rice','Cucumber + Onion','Boondi Raita'),
(3,'Wednesday','Dal Makhani','Aloo Beans','Jeera Rice','Onion + Cucumber','Boondi Raita','Dal Tadka','Shahi Paneer','Jeera Rice','Cucumber + Onion','Boondi Raita'),
(4,'Thursday','Chole Masala','Aloo Jeera','Steamed Rice','Onion + Salad','Plain Raita','Dal Fry','Bhindi Masala','Jeera Rice','Cucumber + Onion','Boondi Raita'),
(5,'Friday','Dal Tadka','Kadhai Paneer','Jeera Rice','Cucumber + Onion','Boondi Raita','Rajma Masala','Aloo Gobhi','Steamed Rice','Onion + Cucumber','Plain Raita'),
(6,'Saturday','Dal Makhani','Mix Veg','Jeera Rice','Cucumber + Onion','Boondi Raita','Dal Fry','Paneer Butter Masala','Jeera Rice','Onion + Cucumber','Boondi Raita'),
(7,'Sunday','Dal Tadka','Matar Paneer','Veg Pulao','Cucumber + Onion','Boondi Raita','Chole Masala','Aloo Jeera','Steamed Rice','Onion + Cucumber','Plain Raita')
ON DUPLICATE KEY UPDATE
lunch_dal=VALUES(lunch_dal),lunch_dry_sabzi=VALUES(lunch_dry_sabzi),lunch_rice=VALUES(lunch_rice),lunch_salad=VALUES(lunch_salad),lunch_raita=VALUES(lunch_raita),
dinner_dal=VALUES(dinner_dal),dinner_dry_sabzi=VALUES(dinner_dry_sabzi),dinner_rice=VALUES(dinner_rice),dinner_salad=VALUES(dinner_salad),dinner_raita=VALUES(dinner_raita);

INSERT INTO plans(name,duration_days,meal_type,price,description,sort_order) VALUES
('Lunch Tiffin - 1 Day',1,'lunch',100,'Dal, sukhi sabji, rice, 4 roti, salad, raita, disposable packing and free delivery',1),
('Dinner Tiffin - 1 Day',1,'dinner',100,'Dal, sukhi sabji, rice, 4 roti, salad, raita, disposable packing and free delivery',2),
('Lunch + Dinner - 1 Day',1,'both',200,'Two fresh tiffins in one day',3),
('Lunch - 7 Days',7,'lunch',700,'7-day lunch subscription',4),
('Dinner - 7 Days',7,'dinner',700,'7-day dinner subscription',5),
('Lunch + Dinner - 7 Days',7,'both',1400,'7-day lunch and dinner subscription',6),
('Lunch - 15 Days',15,'lunch',1500,'15-day lunch subscription',7),
('Dinner - 15 Days',15,'dinner',1500,'15-day dinner subscription',8),
('Lunch + Dinner - 15 Days',15,'both',3000,'15-day lunch and dinner subscription',9),
('Lunch - 30 Days',30,'lunch',3000,'30-day lunch subscription',10),
('Dinner - 30 Days',30,'dinner',3000,'30-day dinner subscription',11),
('Lunch + Dinner - 30 Days',30,'both',6000,'30-day lunch and dinner subscription',12)
ON DUPLICATE KEY UPDATE name=VALUES(name);

INSERT INTO settings(setting_key,setting_value) VALUES
('business_name','RKVeda Tiffin'),
('tagline','Ghar Jaisa Khana, Roz Aapke Ghar'),
('city','Vrindavan, Mathura'),
('state','Uttar Pradesh'),
('currency','INR'),
('delivery_charge','0'),
('support_mobile','+91 81260 37298 / +91 98730 81994'),
('support_email','tiffinrkveda@gmail.com')
ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value);
