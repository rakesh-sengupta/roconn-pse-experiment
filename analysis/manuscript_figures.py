import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt, numpy as np
plt.rcParams.update({'font.family':'serif','font.serif':['DejaVu Serif'],'font.size':8,
                     'axes.linewidth':0.7,'xtick.major.width':0.7,'ytick.major.width':0.7})
INK='#1a2238'; GREY='#8a8f9a'; RED='#b03434'; BLUE='#2c5282'

# ---------- Fig 1: design and session flow ----------
fig, ax = plt.subplots(figsize=(6.85, 2.5)); ax.axis('off')
stages=[('Consent,\neligibility,\ntopic screen','9'),('Reading\n(two passes)','12'),
        ('Order test\ngate ≥6/7','5'),('Distractor\n(fixed)','20'),('Order test\n(covariate)','2'),
        ('Panel\ntraining','3'),('3 pressure blocks\n65 judgements each','22'),
        ('Checks +\ndebrief','8')]
x=0.01; W=0.121
for i,(lab,mins) in enumerate(stages):
    fill = '#e8ebf2' if i!=6 else '#d4dcec'
    ax.add_patch(plt.Rectangle((x,0.42),W,0.34,facecolor=fill,edgecolor=INK,lw=0.7))
    ax.text(x+W/2,0.59,lab,ha='center',va='center',fontsize=6.4,color=INK)
    ax.text(x+W/2,0.35,f'{mins} min',ha='center',va='top',fontsize=5.8,color=GREY)
    if i<len(stages)-1: ax.annotate('',xy=(x+W+0.003,0.59),xytext=(x+W-0.001,0.59),
        arrowprops=dict(arrowstyle='-|>',color=GREY,lw=0.6))
    x+=W+0.004
ax.text(0.01,0.90,'a   Session, ~75 min',fontsize=8,color=INK,weight='bold')
ax.text(0.01,0.20,'b   Between-subjects cells',fontsize=8,color=INK,weight='bold')
cells=[('C1','High-C','Seq 1','Seq 2'),('C2','High-C','Seq 2','Seq 1'),
       ('C3','Low-C','Seq 1','Seq 2'),('C4','Low-C','Seq 2','Seq 1')]
cx=0.01
for c,t,e,p in cells:
    ax.add_patch(plt.Rectangle((cx,-0.06),0.16,0.22,facecolor='white',edgecolor=INK,lw=0.7))
    ax.text(cx+0.008,0.10,f'{c}  {t}',fontsize=6.4,color=INK,weight='bold')
    ax.text(cx+0.008,0.045,f'reads {e} → panel pushes {p}',fontsize=5.8,color=GREY)
    ax.text(cx+0.008,-0.01,'n = 30',fontsize=5.8,color=GREY)
    cx+=0.175
ax.text(0.72,0.10,'Within subjects: pressure 0 / 50 / 100 %',fontsize=6.4,color=INK)
ax.text(0.72,0.045,'block order counterbalanced over all six',fontsize=5.8,color=GREY)
ax.text(0.72,-0.01,'permutations (n ≈ 5 per order per cell)',fontsize=5.8,color=GREY)
ax.set_xlim(0,1); ax.set_ylim(-0.12,1)
plt.tight_layout(pad=0.2); plt.savefig('fig/fig1.pdf',bbox_inches='tight'); plt.close()

# ---------- Fig 2: panels ----------
fig, axes = plt.subplots(1,2,figsize=(4.6,2.4))
pos=np.array([[0.5,0.90],[0.16,0.64],[0.16,0.30],[0.5,0.06],[0.84,0.30],[0.84,0.64]])
edges=[(0,1),(0,2),(1,2)]; bridges=[(0,5),(2,3),(3,4),(4,5)]
for ax,(title,connected) in zip(axes,[('High-C panel',True),('Low-C panel',False)]):
    ax.set_xlim(-0.02,1.02); ax.set_ylim(-0.10,1.06); ax.axis('off')
    if connected:
        for a,b in bridges: ax.plot(*zip(pos[a],pos[b]),color='#c9ccd4',lw=0.7,zorder=1)
        for a,b in edges:   ax.plot(*zip(pos[a],pos[b]),color=RED,lw=1.6,zorder=1)
    for i,(px,py) in enumerate(pos):
        alt = i<3
        ax.scatter([px],[py],s=150,facecolor='white',edgecolor=INK,lw=0.7,zorder=3)
        ax.text(px,py,str(i+1),ha='center',va='center',fontsize=6,color=INK,zorder=4)
        ax.add_patch(plt.Rectangle((px-0.10,py-0.115),0.20,0.052,
                     facecolor=(RED if alt else '#2e7d32'),edgecolor='none',zorder=3))
        ax.text(px,py-0.089,'alt' if alt else 'own',ha='center',va='center',
                fontsize=4.6,color='white',zorder=4)
        if not connected:
            ax.text(px,py-0.155,'independent',ha='center',va='center',fontsize=4.2,color=GREY)
    ax.set_title(title,fontsize=7.5,color=INK,pad=2)
    if connected:
        ax.text(0.5,-0.09,'Group: Krea Seminar Cohort',ha='center',fontsize=5,color='white',
                bbox=dict(facecolor='#7a1f1f',edgecolor='none',pad=1.6))
plt.tight_layout(pad=0.3); plt.savefig('fig/fig2.pdf',bbox_inches='tight'); plt.close()

# ---------- Fig 3: why PSE is insensitive, and what D does ----------
fig, axes = plt.subplots(1,3,figsize=(6.85,2.15))
x=np.arange(2,7)
p_ver=np.array([0.10,0.16,0.50,0.84,0.90])
p_dri=p_ver.copy(); p_dri[1]=0.42; p_dri[3]=0.58     # partial symmetric drift
ax=axes[0]
ax.plot(x,p_ver,'o-',color=BLUE,lw=1.1,ms=3.5,label='0 % pressure')
ax.plot(x,p_dri,'s--',color=RED,lw=1.1,ms=3.5,label='100 % pressure')
ax.axhline(0.5,color=GREY,lw=0.5,ls=':'); ax.axvline(4,color=GREY,lw=0.5,ls=':')
ax.set_xticks(x); ax.set_ylim(0,1); ax.set_xlabel('Probe position (as encoded)')
ax.set_ylabel('P("closer to End")'); ax.legend(frameon=False,fontsize=5.6,loc='upper left')
ax.set_title('a  Drift flattens the curve',fontsize=7,color=INK,loc='left')
ax=axes[1]
ax.bar([0,1],[4.0,4.0],width=0.5,color=['#c9ccd4',BLUE])
ax.set_xticks([0,1]); ax.set_xticklabels(['0 %','100 %'],fontsize=6)
ax.set_ylim(2,6); ax.set_ylabel('Fitted PSE'); ax.axhline(4,color=GREY,lw=0.5,ls=':')
ax.set_title('b  PSE barely moves',fontsize=7,color=INK,loc='left')
ax.text(0.5,5.4,'midpoint unchanged',ha='center',fontsize=5.8,color=GREY)
ax=axes[2]
ax.bar([0,1],[p_ver[1]-p_ver[3], p_dri[1]-p_dri[3]],width=0.5,color=['#c9ccd4',RED])
ax.axhline(0,color=INK,lw=0.6)
ax.set_xticks([0,1]); ax.set_xticklabels(['0 %','100 %'],fontsize=6)
ax.set_ylim(-0.9,0.3); ax.set_ylabel('Drift index  $D=p_3-p_5$')
ax.set_title('c  D tracks it directly',fontsize=7,color=INK,loc='left')
for a in axes: a.spines[['top','right']].set_visible(False); a.tick_params(labelsize=6)
plt.tight_layout(pad=0.4); plt.savefig('fig/fig3.pdf',bbox_inches='tight'); plt.close()
print('figures written')
