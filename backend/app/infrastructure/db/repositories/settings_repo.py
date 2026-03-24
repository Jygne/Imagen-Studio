from sqlalchemy.orm import Session
from app.infrastructure.db.database import SettingsORM, GoogleSheetConfigORM
from app.domain.enums import Provider, ImageSize, ImageQuality


DEFAULT_CLEAN_PROMPT = (
    "严格保持商品主体不变\n"
    "对商品图背景进行重绘，设计同风格不同样式的背景，背景不抢夺商品主体视觉\n"
    "输出图片比例严格限定为1:1\n"
    "去除背景所有文字和icon等内容，只保留纯净的背景和主体\n"
    "去除海报后加的水印内容"
)

DEFAULT_SELLING_PROMPT = (
    "你是专业的电商领域视觉设计专家，现在你需要根据我给你的参考图，直接生成图片。所有生成图前提都需要在保持商品主体不变的前提下进行，包括主体身上的标签信息。输出图片比例严格限定为1:1。\n"
    "核心一：保持商品主体不变，模仿参考图的风格，但不能模仿图中的水印效果，需要完全避免水印，同时需要注意拉开差异化，不能一模一样有抄袭感，但风格也不能偏离参考图。\n"
    "核心二：识别参考图的卖点信息，保持参考图的主色调不变，模仿参考图的排版元素和风格，将参考图中的主次卖点信息替换为我提供给你的主卖点和次卖点。如果没有提供某一类卖点，就不要额外生成这类卖点。\n"
    "核心三：不要出现参考图中的 logo 和品牌标识，完全避免侵权行为。\n"
    "核心四：完全去除水印。\n"
    "核心五：学习并模仿参考图的排版样式、颜色和元素搭配，字体设计样式可以相似但不能抄袭。至少保留一个标题层级与参考图高度一致的视觉样式，优先让主标题继承参考图主标题的字体气质、字重、倾斜感、描边或阴影、主色与辅色搭配、排版位置和整体视觉重心。如果参考图主标题样式非常鲜明，生成图中的主标题必须明显看得出是在参考该样式，而不是重新设计成完全不同的字形语言。\n"
    "核心六：根据参考图的信息量控制版面，只保留 1 个主卖点，次卖点不要超过 3 个，整体设计要干净整洁，易于售卖信息传达。\n"
    "核心七：必须先识别参考图中实际存在几段卖点文字、每段文字的主次层级、文字位置和信息密度，再决定最终输出多少段卖点。输出图中的卖点段数不能超过参考图原本的文字段数，也不能超过参考图原本能承载的信息量。如果参考图只有 1 段卖点文字，就只输出 1 段卖点，优先使用主卖点；如果参考图有 2 段卖点文字，就输出 1 个主卖点加 1 个次卖点；如果参考图有 3 段卖点文字，就输出 1 个主卖点加最多 2 个次卖点；依次类推。绝对不允许参考图只有 1 段文字时，强行塞入主卖点和多个次卖点。\n"
    "文字样式补充要求：\n"
    "1. 先识别参考图中最重要的标题样式，并优先复用到生成图的主卖点文案上。\n"
    "2. 如果参考图里主标题有明显的手写感、圆润感、童趣感、科技感、粗黑体、描边字、投影字、胶囊底板、色块标签等特征，生成图至少保留其中一种核心特征。\n"
    "3. 次卖点可以做适度简化，但主标题或次标题至少要有一个与参考图的文字风格明显相似。\n"
    "4. 不要只模仿背景和构图，文字样式也必须参考原图。\n"
    "5. 最终文字内容必须替换成我提供的新卖点，不得沿用参考图原文。\n"
    "6. 最终文案层级、数量、位置关系必须服从参考图原有结构，而不是机械地把所有卖点都堆上去。\n"
    "主卖点：\n"
    "{main_selling_point}\n"
    "次卖点：\n"
    "{secondary_selling_points}\n"
    "现在请结合以上前提和六条核心要点，开始生成图片。"
)


class SettingsRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_settings(self) -> SettingsORM:
        settings = self.db.query(SettingsORM).filter(SettingsORM.id == 1).first()
        if not settings:
            settings = SettingsORM(
                id=1,
                clean_image_prompt=DEFAULT_CLEAN_PROMPT,
                selling_point_prompt=DEFAULT_SELLING_PROMPT,
            )
            self.db.add(settings)
            self.db.commit()
            self.db.refresh(settings)
        return settings

    def update_settings(self, updates: dict) -> SettingsORM:
        settings = self.get_settings()
        for k, v in updates.items():
            if v is not None:
                setattr(settings, k, v)
        self.db.commit()
        self.db.refresh(settings)
        return settings

    def get_google_sheet_config(self) -> GoogleSheetConfigORM:
        config = self.db.query(GoogleSheetConfigORM).filter(GoogleSheetConfigORM.id == 1).first()
        if not config:
            config = GoogleSheetConfigORM(id=1)
            self.db.add(config)
            self.db.commit()
            self.db.refresh(config)
        return config

    def update_google_sheet_config(self, updates: dict) -> GoogleSheetConfigORM:
        config = self.get_google_sheet_config()
        for k, v in updates.items():
            if v is not None:
                setattr(config, k, v)
        self.db.commit()
        self.db.refresh(config)
        return config
