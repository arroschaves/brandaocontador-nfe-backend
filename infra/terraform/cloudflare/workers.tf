resource "cloudflare_worker_script" "api_routing" {
  name    = "api-routing"
  content = <<EOT
addEventListener('fetch', event => {
  event.respondWith(handle(event.request))
})
async function handle(request) {
  const url = new URL(request.url)
  if (url.pathname.startsWith('/api')) {
    return fetch(request)
  }
  return new Response('OK')
}
EOT
}

resource "cloudflare_worker_route" "api_route" {
  zone_id  = cloudflare_zone.zone.id
  pattern  = "nfe.${var.zone}/*"
  script_name = cloudflare_worker_script.api_routing.name
}
