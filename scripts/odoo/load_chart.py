# Carga el plan contable boliviano en la base `proyecto309`.
# Ejecutar con: odoo shell -d proyecto309 < /tmp/load_chart.py
company = env.company
country = env['res.country'].search([('code', '=', 'BO')], limit=1)
currency = env['res.currency'].search([('name', '=', 'BOB')], limit=1)

print('ANTES:', company.name, '| pais:', company.country_id.code, '| moneda:', company.currency_id.name, '| chart:', company.chart_template)

if country and company.country_id != country:
    company.country_id = country
if currency and company.currency_id != currency:
    company.currency_id = currency
env.cr.commit()

if not company.chart_template:
    env['account.chart.template'].try_loading('bo', company)
    env.cr.commit()

print('DESPUES:', company.name, '| pais:', company.country_id.code, '| moneda:', company.currency_id.name, '| chart:', company.chart_template)
print('CUENTAS:', env['account.account'].search_count([]))
print('DIARIOS:', env['account.journal'].search_count([]))
sale_journal = env['account.journal'].search([('type', '=', 'sale')], limit=1)
print('DIARIO VENTAS:', sale_journal.name if sale_journal else 'NO HAY')
print('IMPUESTOS:', env['account.tax'].search_count([('type_tax_use', '=', 'sale')]))
