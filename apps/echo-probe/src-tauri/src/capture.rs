use base64::{engine::general_purpose::STANDARD, Engine as _};

pub fn capture_primary_monitor_png_base64() -> Result<String, String> {
    let monitors = xcap::Monitor::all().map_err(|e| format!("Monitor enumeration failed: {e}"))?;
    let primary = monitors
        .into_iter()
        .find(|m| m.is_primary())
        .ok_or_else(|| "No primary monitor found.".to_string())?;

    let image = primary
        .capture_image()
        .map_err(|e| format!("Screen capture failed: {e}"))?;

    let mut png_bytes: Vec<u8> = Vec::new();
    image
        .write_to(
            &mut std::io::Cursor::new(&mut png_bytes),
            image::ImageFormat::Png,
        )
        .map_err(|e| format!("PNG encode failed: {e}"))?;

    if png_bytes.is_empty() {
        return Err("Capture returned empty PNG.".to_string());
    }

    Ok(STANDARD.encode(png_bytes))
}

pub fn capture_primary_monitor_dimensions() -> Result<(u32, u32), String> {
    let monitors = xcap::Monitor::all().map_err(|e| format!("Monitor enumeration failed: {e}"))?;
    let primary = monitors
        .into_iter()
        .find(|m| m.is_primary())
        .ok_or_else(|| "No primary monitor found.".to_string())?;
    Ok((primary.width(), primary.height()))
}
