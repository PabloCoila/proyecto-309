# Crea 3 productos almacenables de demostración (sin cantidades).
# La cantidad se registra luego desde la app (ajuste de inventario).
Product = env['product.product']

# Marca visible en la barra superior de Odoo
if env.company.name != 'Proyecto 309':
    env.company.name = 'Proyecto 309'
    print('EMPRESA RENOMBRADA:', env.company.name)

catalog = [
    ('Teclado mecánico Pro 309', 'KB-309', 420.0),
    ('Monitor 27 pulgadas 165 Hz', 'MON-27', 2150.0),
    ('Cable USB-C trenzado 2 m', 'CAB-2M', 85.0),
]

for name, code, price in catalog:
    product = Product.search([('default_code', '=', code)], limit=1)
    if not product:
        product = Product.create({
            'name': name,
            'default_code': code,
            'detailed_type': 'product',
            'list_price': price,
            'sale_ok': True,
            'purchase_ok': True,
        })
        print('CREADO', product.id, product.name, product.list_price)
    else:
        print('EXISTE', product.id, product.name, product.list_price)

env.cr.commit()
print('TOTAL PRODUCTOS:', Product.search_count([('default_code', 'in', ['KB-309', 'MON-27', 'CAB-2M'])]))
print('ALMACENES:', env['stock.warehouse'].search_count([]))
for location in env['stock.location'].search([('usage', '=', 'internal')]):
    print('UBICACION', location.complete_name)
