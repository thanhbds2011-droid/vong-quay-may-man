"""Functional smoke / regression checks. Requires playwright + local HTTP server."""
from playwright.sync_api import sync_playwright
from pathlib import Path

BASE = 'http://127.0.0.1:8765/'
ART = Path(__file__).resolve().parent

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        errors = []
        context = browser.new_context(viewport={'width': 1360, 'height': 960}, device_scale_factor=1)
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(BASE, wait_until='networkidle')
        page.screenshot(path=str(ART/'desktop-setup.png'), full_page=True)
        assert page.locator('#player-count').inner_text() == '5'
        assert page.locator('.player-name-input').count() == 5
        for i,name in enumerate(['Anh A','Chị B','Anh C','Chị D','Anh E']):
            page.locator('.player-name-input').nth(i).fill(name)
        page.locator('#start-button').click()
        assert page.locator('#game-screen').is_visible()
        page.screenshot(path=str(ART/'desktop-game.png'), full_page=True)
        page.add_style_tag(content='.spinner-rotor {transition-duration: .12s !important;}')
        results=[]
        for i in range(5):
            page.locator('#spin-button').click()
            assert page.locator('#spin-button').is_disabled()
            page.locator('#result-card').wait_for(state='visible', timeout=8000)
            val=int(page.locator('#result-number').inner_text())
            assert val not in results, f'duplicate {val} seen'
            results.append(val)
            assert page.locator('.game-person.done').count() == i+1
            if i<4:
                page.locator('#continue-button').click()
                assert page.locator('#game-screen').is_visible()
            else:
                page.locator('#continue-button').click()
        assert sorted(results)==[1,2,3,4,5], results
        assert page.locator('#summary-screen').is_visible()
        assert page.locator('#winner-number').inner_text() == '01'
        assert page.locator('.leader-row').count()==5
        page.screenshot(path=str(ART/'desktop-summary.png'), full_page=True)
        page.locator('#history-toggle').click()
        assert page.locator('.history-entry').count()==1
        page.locator('#done-history').click()
        page.reload(wait_until='domcontentloaded')
        assert page.locator('#summary-screen').is_visible()
        page.locator('#replay-button').click()
        assert page.locator('#game-screen').is_visible()
        assert page.locator('.game-person.done').count()==0
        assert page.locator('#current-name').inner_text()=='Anh A'
        # Mid-spin reload must commit the reserved number once, with no duplication on next turn.
        page.locator('#spin-button').click()
        page.reload(wait_until='domcontentloaded')
        assert page.locator('#result-card').is_visible(), 'mid-spin reload lost result'
        first_value=int(page.locator('#result-number').inner_text())
        assert page.locator('.game-person.done').count()==1
        page.reload(wait_until='domcontentloaded')
        assert int(page.locator('#result-number').inner_text())==first_value
        page.locator('#continue-button').click()
        assert page.locator('.game-person.done').count()==1
        # Cancel new round confirmation must respect Cancel.
        page.once('dialog', lambda dialog: dialog.dismiss())
        page.locator('#reset-active').click()
        assert page.locator('#game-screen').is_visible()
        assert page.locator('.game-person.done').count()==1
        page.once('dialog', lambda dialog: dialog.accept())
        page.locator('#reset-active').click()
        assert page.locator('.game-person.done').count()==0
        assert not errors, errors
        context.close()

        # Mobile layout + editing count + default name + sound + fullscreen control.
        mobile = browser.new_context(viewport={'width':390,'height':844}, device_scale_factor=1, is_mobile=True, has_touch=True)
        mp = mobile.new_page()
        mp.on('pageerror',lambda err: errors.append(str(err)))
        mp.goto(BASE, wait_until='networkidle')
        mp.locator('#increase-count').click()
        assert mp.locator('.player-name-input').count()==6
        mp.locator('#decrease-count').click()
        assert mp.locator('.player-name-input').count()==5
        mp.locator('#sound-toggle').click()
        assert mp.locator('#sound-toggle').get_attribute('aria-pressed')=='false'
        mp.screenshot(path=str(ART/'mobile-setup.png'), full_page=True)
        width = mp.evaluate('document.documentElement.scrollWidth')
        assert width <= 390, f'horizontal overflow: {width}'
        mp.locator('#start-button').click()
        mp.screenshot(path=str(ART/'mobile-game.png'), full_page=True)
        assert mp.locator('#current-name').inner_text()=='Người 1'
        assert mp.evaluate('document.documentElement.scrollWidth') <= 390
        mp.add_style_tag(content='.spinner-rotor {transition-duration:.12s!important;}')
        mp.locator('#spin-button').click()
        mp.locator('#result-card').wait_for(state='visible', timeout=8000)
        mp.screenshot(path=str(ART/'mobile-result.png'), full_page=True)
        assert mp.evaluate('document.documentElement.scrollWidth') <= 390
        assert not errors, errors
        mobile.close()
        browser.close()
        print('PASS: desktop/mobile, 5 unique spins, winner, history, replay, reload mid-spin, cancel, sound, layouts.')

if __name__ == '__main__': run()
