<?php
// tiles.php - อ่าน MBTiles แบบ XYZ
$db = 'ortho.mbtiles'; // ชื่อไฟล์ของคุณ

$z = $_GET['z'];
$x = $_GET['x'];
$y = $_GET['y'];

// ตรวจสอบ Metadata Request
if (isset($_GET['metadata'])) {
    try {
        $conn = new PDO("sqlite:$db");
        $stmt = $conn->query("SELECT value FROM metadata WHERE name = 'bounds'");
        $bounds = $stmt->fetchColumn();

        header('Content-Type: application/json');
        echo json_encode(['bounds' => $bounds]); // Format: "minLon,minLat,maxLon,maxLat"
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// ตรวจสอบ Input
if (!isset($z) || !isset($x) || !isset($y)) {
    http_response_code(400);
    die('Missing parameters');
}

try {
    // เชื่อมต่อ SQLite
    $conn = new PDO("sqlite:$db");

    // ** เทคนิคสำคัญ: แปลง XYZ (Google) เป็น TMS (MBTiles Standard) **
    // สูตร: y_tms = (2^z) - 1 - y_xyz
    $y_tms = (1 << $z) - 1 - $y;

    // Query ดึงรูปภาพ
    $sql = "SELECT tile_data FROM tiles WHERE zoom_level = :z AND tile_column = :x AND tile_row = :y";
    $stmt = $conn->prepare($sql);
    $stmt->execute([':z' => $z, ':x' => $x, ':y' => $y_tms]);
    $blob = $stmt->fetchColumn();

    if ($blob) {
        // ส่งรูปภาพกลับไปให้ Browser
        header('Content-Type: image/png'); // หรือ image/jpeg ตามข้อมูลจริง
        header('Content-Length: ' . strlen($blob));
        echo $blob;
    } else {
        http_response_code(404);
        die('Tile not found');
    }
} catch (PDOException $e) {
    http_response_code(500);
    die('Database Error');
}
?>