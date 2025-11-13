terraform {
  required_providers {
    cloudflare = {
      source = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.api_token
}

variable "api_token" {}
variable "zone" {}

resource "cloudflare_zone" "zone" {
  name = var.zone
}

resource "cloudflare_record" "api" {
  zone_id = cloudflare_zone.zone.id
  name    = "api"
  value   = var.api_value
  type    = "A"
  proxied = true
}

variable "api_value" {}

resource "cloudflare_page_rule" "cache" {
  zone_id  = cloudflare_zone.zone.id
  target   = "nfe.${var.zone}/*"
  actions  = jsonencode({ cache_level = "Cache Everything" })
}

resource "cloudflare_ruleset" "waf" {
  zone_id = cloudflare_zone.zone.id
  name    = "API WAF"
  kind    = "zone"
  phase   = "http_request_firewall_custom"
}
