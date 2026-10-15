"""Browser regression suite for independent spins, duplicate resolution and V1 migration.
Run: python tests/test_browser_v1_1.py (sandbox browser, no server required)
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'index.html').read_text(encoding='utf-8')
OUT=Path(__file__).resolve().parent
KEY='tanhiep-water-wheel-v1'

def boot(page, seed=None):
    page.set_content(HTML, wait_until='domcontentloaded')
    page.add_style_tag(path=str(ROOT/'styles.css'))
    page.evaluate('''(args) => {
      const data = args.seed ? {[args.key]: JSON.stringify(args.seed)} : {};
      Object.defineProperty(window, 'localStorage', {
        configurable:true,
        value:{getItem(k){return Object.prototype.hasOwnProperty.call(data,k) ? data[k] : null},
          setItem(k,v){data[k]=String(v)}, removeItem(k){delete data[k]}}
      });
    }''', {'seed':seed,'key':KEY})
    page.add_script_tag(path=str(ROOT/'app.js'))

def fresh_page(context, previous, errors):
    seed=get_state(previous)
    previous.close()
    new=context.new_page()
    new.on('pageerror',lambda e:errors.append(str(e)))
    boot(new,seed)
    return new

def get_state(page):
    return json.loads(page.evaluate('(k) => localStorage.getItem(k)', KEY))

def force_draw(page, index):
    # Replace only randomness, not production gameplay. One call to pick a number,
    # and a second call for visual extra rotations (always 0).
    page.evaluate('''(index) => {
      window.__chooseIndex = index;
      window.secureIndex = length => {
        const value = window.__chooseIndex;
        window.__chooseIndex = 0;
        return value % length;
      };
    }''', index)

def roll(page, index, expected, last=False):
    force_draw(page,index)
    page.locator('#spin-button').click()
    assert get_state(page)['phase']=='spinning'
    page.locator('#result-card').wait_for(state='visible', timeout=9000)
    assert int(page.locator('#result-number').inner_text())==expected, (get_state(page),expected)
    assert get_state(page)['players'][get_state(page)['queue'][get_state(page)['currentIndex']]]['number']==expected
    page.locator('#continue-button').click()
    if last:
        assert get_state(page)['phase'] in ('review','complete')

def run():
    errors=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':1360,'height':960},device_scale_factor=1)
        page=context.new_page()
        page.on('pageerror', lambda e:errors.append(str(e)))
        boot(page)
        assert page.locator('#player-count').inner_text()=='5'
        assert get_state(page)['v']==2
        page.screenshot(path=str(OUT/'desktop-setup-v1.1.png'),full_page=True)
        for i,n in enumerate(['Anh A','Chị B','Anh C','Chị D','Anh E']):
            page.locator('.player-name-input').nth(i).fill(n)
        page.locator('#start-button').click()
        assert page.locator('#game-screen').is_visible()
        page.screenshot(path=str(OUT/'desktop-game-v1.1.png'),full_page=True)
        page.add_style_tag(content='.spinner-rotor{transition-duration:.10s!important}')
        # All five players get the FULL range. Even consecutive players may draw 5.
        for i,(choice, expected) in enumerate([(4,5),(4,5),(2,3),(0,1),(1,2)]):
            roll(page,choice,expected,last=i==4)
        assert get_state(page)['phase']=='review'
        assert page.locator('#review-card').is_visible()
        assert page.locator('.game-person.duplicate').count()==2
        assert page.locator('.game-person.done').count()==3
        assert get_state(page)['queue']==[0,1,2,3,4]
        assert set(player['number'] for player in get_state(page)['players'] if player['status']=='locked')=={1,2,3}
        page.screenshot(path=str(OUT/'desktop-review-v1.1.png'),full_page=True)
        # Round 2: only players 0 & 1, eligible numbers are 4 & 5.
        page.locator('#next-stage-button').click()
        assert get_state(page)['stage']==2
        assert get_state(page)['queue']==[0,1]
        assert page.locator('#current-name').inner_text()=='Anh A'
        assert get_state(page)['players'][0]['number'] is None
        assert set(page.evaluate('eligibleNumbers()'))=={4,5}
        assert 'ĐÃ CHỐT' in page.locator('#game-wheel').get_attribute('aria-label') or 'Số đã chốt' in page.locator('#game-wheel').get_attribute('aria-label')
        force_draw(page,0)
        page.locator('#spin-button').click()
        pending=get_state(page)['pending']
        assert pending['number']==4 and pending['stage']==2
        # Reload midspin, and still receive the identical persisted number.
        page=fresh_page(context,page,errors)
        assert get_state(page)['phase']=='revealed'
        assert int(page.locator('#result-number').inner_text())==4
        page=fresh_page(context,page,errors)
        assert int(page.locator('#result-number').inner_text())==4
        page.locator('#continue-button').click()
        page.add_style_tag(content='.spinner-rotor{transition-duration:.10s!important}')
        roll(page,0,4,last=True)  # Two people both drew 4, reroll AGAIN.
        assert get_state(page)['phase']=='review'
        assert page.locator('.game-person.duplicate').count()==2
        page.locator('#next-stage-button').click()
        assert get_state(page)['stage']==3
        assert set(page.evaluate('eligibleNumbers()'))=={4,5}
        # Third stage: independent picks, now unique.
        roll(page,1,5)
        roll(page,0,4,last=True)
        assert get_state(page)['phase']=='complete'
        assert page.locator('#summary-screen').is_visible()
        assert page.locator('#winner-name').inner_text()=='Chị D'
        assert page.locator('#winner-number').inner_text()=='01'
        assert [p['number'] for p in get_state(page)['players']]==[5,4,3,1,2]
        assert get_state(page)['history'][0]['stages']==3
        page.screenshot(path=str(OUT/'desktop-summary-v1.1.png'),full_page=True)
        page.locator('#history-toggle').click()
        assert page.locator('.history-entry').count()==1
        page.locator('#done-history').click()
        page=fresh_page(context,page,errors)
        assert page.locator('#summary-screen').is_visible()
        page.locator('#replay-button').click()
        assert get_state(page)['stage']==1
        assert get_state(page)['queue']==[0,1,2,3,4]
        assert all(p['number'] is None for p in get_state(page)['players'])
        page.once('dialog', lambda d:d.dismiss())
        page.locator('#reset-active').click()
        assert get_state(page)['phase']=='ready'
        page.once('dialog', lambda d:d.accept())
        page.locator('#reset-active').click()
        assert get_state(page)['stage']==1
        assert all(p['number'] is None for p in get_state(page)['players'])
        context.close()

        # V1 -> V1.1: names/history survive. Old unfinished game is reset,
        # as the V1 rule was not compatible with the new fairness model.
        migrated=browser.new_context(viewport={'width':1280,'height':850})
        oldstate={'v':1,'phase':'ready','draftNames':['A','B'],'players':[{'id':'person-1','name':'A','number':5},{'id':'person-2','name':'B','number':None}], 'currentIndex':1,'rotation':0,'pending':None,'sound':False,'history':[{'id':'old','completedAt':1,'players':[{'name':'A','number':1}]}],'roundId':'oldgame'}
        
        mp=migrated.new_page()
        boot(mp,oldstate)
        assert get_state(mp)['v']==2 and get_state(mp)['phase']=='setup'
        assert get_state(mp)['history'][0]['id']=='old'
        assert get_state(mp)['draftNames']==['A','B']
        assert get_state(mp)['sound'] is False
        migrated.close()

        mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
        m=mobile.new_page();m.on('pageerror',lambda e:errors.append(str(e)))
        boot(m)
        m.locator('#increase-count').click()
        assert m.locator('.player-name-input').count()==6
        m.locator('#decrease-count').click()
        assert m.locator('.player-name-input').count()==5
        m.locator('#sound-toggle').click()
        assert m.locator('#sound-toggle').get_attribute('aria-pressed')=='false'
        assert m.evaluate('document.documentElement.scrollWidth')<=390
        m.screenshot(path=str(OUT/'mobile-setup-v1.1.png'),full_page=True)
        m.locator('#start-button').click()
        assert m.evaluate('document.documentElement.scrollWidth')<=390
        m.add_style_tag(content='.spinner-rotor{transition-duration:.10s!important}')
        force_draw(m,0)
        m.locator('#spin-button').click()
        m.locator('#result-card').wait_for(state='visible',timeout=9000)
        assert m.evaluate('document.documentElement.scrollWidth')<=390
        m.screenshot(path=str(OUT/'mobile-result-v1.1.png'),full_page=True)
        assert not errors,errors
        print('PASS: independent repeat number, multi-stage duplicate resolution, only locked numbers excluded, reload midspin, final winner, history, migration, restart confirm, responsive 390px, sound toggle, JS errors zero')
        browser.close()

if __name__=='__main__':run()
