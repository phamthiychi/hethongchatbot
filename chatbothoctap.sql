DROP TABLE IF EXISTS `mapping_data`;
DROP TABLE IF EXISTS `data`;
DROP TABLE IF EXISTS `danhmuc`;
DROP TABLE IF EXISTS `chat_history`;
DROP TABLE IF EXISTS `user`;
DROP TABLE IF EXISTS `history`;

CREATE TABLE `history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sesion_key` varchar(255) DEFAULT NULL,
  `cauhoi` text,
  `cautraloi` text,
  `created` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `danhmuc` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci	;

CREATE TABLE `user` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci	;

CREATE TABLE `chat_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `session_id` varchar(64) DEFAULT NULL,
  `role` enum('user','assistant') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci	 DEFAULT NULL,
  `content` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `danhmuc` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=79 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci	;

CREATE TABLE `danhmuc` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ten` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci	;

CREATE TABLE `data` (
  `id` int NOT NULL AUTO_INCREMENT,
  `danhmuc` int DEFAULT NULL,
  `cauhoi` varchar(255) DEFAULT NULL,
  `cautraloi` text,
  PRIMARY KEY (`id`),
  KEY `fk_danhmuc` (`danhmuc`),
  CONSTRAINT `fk_danhmuc` FOREIGN KEY (`danhmuc`) REFERENCES `danhmuc` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci ;

CREATE TABLE `mapping_data` (
  `id` int NOT NULL AUTO_INCREMENT,
  `data_id` int NOT NULL,
  `chat_history_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `data_id` (`data_id`),
  KEY `chat_history_id` (`chat_history_id`),
  CONSTRAINT `mapping_data_ibfk_1` FOREIGN KEY (`data_id`) REFERENCES `data` (`id`),
  CONSTRAINT `mapping_data_ibfk_2` FOREIGN KEY (`chat_history_id`) REFERENCES `chat_history` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci	;






