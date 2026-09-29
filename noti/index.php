<?php
// index.php en https://chat.clubkarlabeauty.cl/
header('Content-Type: application/json');

// Capturar los datos JSON enviados desde el NAS
$jsonInput = file_get_contents('php://input');
$data = json_decode($jsonInput, true);

if ($data) {
    $titulo = $data['title'] ?? 'Notificación del NAS';
    $mensaje = $data['message'] ?? 'Sin mensaje';
    $evento = $data['event'] ?? 'info';

    // ==================================================================
    // OPCIÓN A: Recibir mensaje en tu Telegram personal (RECOMENDADO)
    // ==================================================================
    // 1. Habla con @BotFather en Telegram, crea un bot y pega tu Token aquí.
    // 2. Habla con @userinfobot en Telegram y pega tu Chat ID aquí.
    $botToken = "TU_BOT_TOKEN_AQUI"; 
    $chatId   = "TU_CHAT_ID_AQUI";

    if ($botToken !== "TU_BOT_TOKEN_AQUI" && !empty($botToken)) {
        $emoji = ($evento === 'success') ? '✅' : (($evento === 'error') ? '❌' : 'ℹ️');
        $texto = "{$emoji} *{$titulo}*\n\n{$mensaje}\n\n_Fecha: " . date("Y-m-d H:i:s") . "_";
        $urlTg = "https://api.telegram.org/bot{$botToken}/sendMessage?chat_id={$chatId}&parse_mode=Markdown&text=" . urlencode($texto);
        @file_get_contents($urlTg);
    }

    // ==================================================================
    // OPCIÓN B: Recibir en tu teléfono mediante la App "ntfy" (Android/iOS)
    // ==================================================================
    // 1. Descarga la App gratuita "ntfy" en tu teléfono.
    // 2. Suscríbete al tema que elijas aquí (ej: clubkarlabeauty_nas_123).
    $temaNtfy = "clubkarlabeauty_nas_123";
    if (!empty($temaNtfy)) {
        $urlNtfy = "https://ntfy.sh/{$temaNtfy}/publish?title=" . urlencode($titulo) . "&message=" . urlencode($mensaje);
        @file_get_contents($urlNtfy);
    }

    // ==================================================================
    // OPCIÓN C: Recibir por Correo Electrónico (Gmail / Apple Mail)
    // ==================================================================
    $emailDestino = "tu_email@gmail.com";
    if ($emailDestino !== "tu_email@gmail.com" && !empty($emailDestino)) {
        $asunto = "[" . strtoupper($evento) . "] " . $titulo;
        $cuerpo = "Hola,\n\nTu NAS de Telegram te notifica:\n\n"
                . "Título: " . $titulo . "\n"
                . "Detalle: " . $mensaje . "\n\n"
                . "Fecha: " . date("Y-m-d H:i:s");
        @mail($emailDestino, $asunto, $cuerpo, "From: nas@clubkarlabeauty.cl\r\n");
    }

    // Responder con éxito al NAS
    echo json_encode(["status" => "success", "received" => true]);
    exit;
}

echo json_encode(["status" => "error", "message" => "Esperando petición POST JSON del NAS"]);
?>