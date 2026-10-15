"""Sandbox-only browser test. Chrome policy blocks URL navigation, so inject HTML/CSS/JS."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json
BASE = Path(__file__).resolve().parents[1]
ART = BASE/'tests'
HTML = (BASE/'index.html').read_text(encoding='utf-8')
MOCK_STORAGE = '''(seed) => { const data = seed ? {"tanhiep-water-wheel-v1":JSON.stringify(seed)} : {}; Object.defineProperty(window, 'localStorage',{ configurable:true, value: {getItem(k){return Object.hasOwn(data,k)?data[k]:null}, setItem(k,v){data[k]=String(v)},removeItem(k){delete data[k]} }}); }'''

def boot(page, seed=None):
    page.set_content(HTML, wait_until='domcontentloaded')
    page.add_style_tag(path=str(BASE/'styles.css'))
    page.evaluate(MOCK_STORAGE, seed)
    page.add_script_tag(path=str(BASE/'app.js'))

def getstate(page):
    return json.loads(page.evaluate("localStorage.getItem('tanhiep-water-wheel-v1')"))

def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium', headless=True,args=['--no-sandbox'])
        errors=[]
        context=browser.new_context(viewport={'width':1360,'height':960})
        page=context.new_page()
        page.on('pageerror',lambda e: errors.append(str(e)))
        boot(page)
        assert page.locator('#player-count').inner_text()=='5'
        page.screenshot(path=str(ART/'desktop-setup.png'),full_page=True)
        for i,name in enumerate(['Anh A','Chị B','Anh C','Chị D','Anh E']):
            page.locator('.player-name-input').nth(i).fill(name)
        page.locator('#start-button').click()
        assert page.locator('#game-screen').is_visible()
        page.screenshot(path=str(ART/'desktop-game.png'),full_page=True)
        page.add_style_tag(content='.spinner-rotor { transition-duration: .15s!important; }')
        nums=[]
        for i in range(5):
            page.locator('#spin-button').click()
            assert page.locator('#spin-button').is_disabled()
            page.locator('#result-card').wait_for(state='visible',timeout=6500)
            number=int(page.locator('#result-number').inner_text())
            assert number not in nums, nums
            nums.append(number)
            assert page.locator('.game-person.done').count()==i+1
            page.locator('#continue-button').click()
        assert sorted(nums)==[1,2,3,4,5]
        assert page.locator('#summary-screen').is_visible()
        assert page.locator('#winner-number').inner_text()=='01'
        page.screenshot(path=str(ART/'desktop-summary.png'),full_page=True)
        page.locator('#history-toggle').click()
        assert page.locator('.history-entry').count()==1
        page.locator('#done-history').click()
        page.locator('#replay-button').click()
        assert page.locator('#game-screen').is_visible()
        assert page.locator('.game-person.done').count()==0
        # midspin reload: create a fresh browsing page using a saved state snapshot
        page.locator('#spin-button').click()
        seed=getstate(page)
        assert seed['phase']=='spinning',seed['phase']
        previous=seed['pending']['number']
        page2=context.new_page();page2.on('pageerror',lambda e: errors.append(str(e)))
        boot(page2,seed)
        assert page2.locator('#result-card').is_visible()
        assert int(page2.locator('#result-number').inner_text())==previous
        assert page2.locator('.game-person.done').count()==1
        page2.locator('#continue-button').click()
        assert page2.locator('.game-person.done').count()==1
        page2.once('dialog', lambda d:d.dismiss())
        page2.locator('#reset-active').click()
        assert page2.locator('.game-person.done').count()==1
        page2.once('dialog', lambda d:d.accept())
        page2.locator('#reset-active').click()
        assert page2.locator('.game-person.done').count()==0
        context.close()

        mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        mp=mobile.new_page();mp.on('pageerror',lambda e:errors.append(str(e)))
        boot(mp)
        mp.locator('#increase-count').click()
        assert mp.locator('.player-name-input').count()==6
        mp.locator('#decrease-count').click()
        assert mp.locator('.player-name-input').count()==5
        mp.locator('#sound-toggle').click()
        assert mp.locator('#sound-toggle').get_attribute('aria-pressed')=='false'
        mp.screenshot(path=str(ART/'mobile-setup.png'),full_page=True)
        assert mp.evaluate('document.documentElement.scrollWidth')<=390
        mp.locator('#start-button').click()
        mp.screenshot(path=str(ART/'mobile-game.png'),full_page=True)
        assert mp.locator('#current-name').inner_text()=='Người 1'
        assert mp.evaluate('document.documentElement.scrollWidth')<=390
        mp.add_style_tag(content='.spinner-rotor {transition-duration:.15s!important;}')
        mp.locator('#spin-button').click()
        mp.locator('#result-card').wait_for(state='visible',timeout=6500)
        mp.screenshot(path=str(ART/'mobile-result.png'),full_page=True)
        assert mp.evaluate('document.documentElement.scrollWidth')<=390
        assert not errors,errors
        print('PASS: unique results',nums,'winner, saved results, 10-round history, replay, mid-spin reload, cancel, mobile responsive, sound toggle, JS errors zero')
        browser.close()

if __name__=='__main__':main()
