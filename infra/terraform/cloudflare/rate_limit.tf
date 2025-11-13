resource "cloudflare_rate_limit" "api_limit" {
  zone_id = cloudflare_zone.zone.id
  threshold = 600
  period    = 60
  match {
    request {
      methods = ["GET","POST","PUT","DELETE"]
      schemes = ["HTTP","HTTPS"]
      url     = "*.${var.zone}/api/*"
    }
  }
  action {
    mode = "simulate"
    timeout = 60
    response {
      content_type = "application/json"
      body = "{\"error\":\"rate_limit\"}"
    }
  }
}
